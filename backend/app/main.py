import os
import re
import sys
import socket
import getpass
import asyncio
import traceback
from datetime import datetime, date
from typing import List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, UploadFile, File, Form, Depends, HTTPException, status, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc
from dotenv import load_dotenv

if getattr(sys, "frozen", False):
    BASE_DIR = sys._MEIPASS
else:
    BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

env_path = os.path.join(BASE_DIR, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

from app.database import get_db, engine, Base, inicializar_base_de_datos
from app import models
from app.services.storage import subir_comprobante_a_nube
from app.ai_extractor import procesar_documentos_factura

@asynccontextmanager
async def lifespan(app: FastAPI):
    asyncio.create_task(asyncio.to_thread(inicializar_base_de_datos))
    yield

app = FastAPI(title="Mobadent Invoices API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIR = os.path.join(BASE_DIR, "frontend")
if os.path.exists(FRONTEND_DIR):
    app.mount("/frontend", StaticFiles(directory=FRONTEND_DIR, html=True), name="frontend")

@app.get("/")
def raiz():
    return RedirectResponse(url="/frontend/dashboard.html")

def normalizar_nombre(texto: str) -> str:
    texto = texto.lower().strip()
    texto = re.sub(r'\s+', ' ', texto)
    return texto[:240]

def limpiar_float(val, default: float = 0.0) -> float:
    if val is None:
        return default
    if isinstance(val, (int, float)):
        return float(val)
    txt = str(val).strip().replace("$", "").replace(",", ".")
    if not txt:
        return default
    try:
        return float(txt)
    except (ValueError, TypeError):
        return default

def identificar_dispositivo_local() -> str:
    usuario_env = os.getenv("DEVICE_IDENTIFIER") or os.getenv("CLINICA_USUARIO")
    if usuario_env:
        return usuario_env.strip()
    try:
        user = getpass.getuser()
        return user.capitalize()
    except Exception:
        return "Usuario"


# ==========================================
# ENDPOINT DE ANÁLISIS MULTI-HOJA CON IA
# ==========================================

@app.post("/api/facturas/analizar")
async def analizar_factura_con_ia(files: List[UploadFile] = File(...)):
    try:
        archivos = []
        urls_subidas = []

        for f in files:
            contenido = await f.read()
            mime = f.content_type or "application/octet-stream"
            archivos.append((contenido, mime))

            try:
                url_s = subir_comprobante_a_nube(contenido, f.filename, carpeta="facturas")
                if url_s:
                    urls_subidas.append(url_s)
            except Exception as err_s:
                print(f"Aviso al subir hoja a Supabase: {err_s}")

        resultado_ia = await procesar_documentos_factura(archivos)
        datos = resultado_ia.model_dump()
        datos["url_factura"] = ",".join(urls_subidas) if urls_subidas else None

        return datos
    except Exception as e:
        tb = traceback.format_exc()
        print(f"Error procesando factura con IA:\n{tb}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"{str(e)}\n\nDetalle técnico:\n{tb}"
        )


# ==========================================
# VERIFICACIÓN DE FACTURA DUPLICADA EN VIVO
# ==========================================

@app.get("/api/facturas/verificar-duplicado")
def verificar_factura_duplicada(
    numero_factura: str = Query(..., min_length=1),
    proveedor_ruc: Optional[str] = Query(None),
    proveedor_nombre: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    num_limpio = numero_factura.strip()
    if not num_limpio:
        return {"existe": False}

    query = (
        db.query(models.Factura)
        .join(models.Proveedor, models.Factura.proveedor_id == models.Proveedor.id)
        .filter(models.Factura.numero_factura.ilike(num_limpio))
    )

    if proveedor_ruc and proveedor_ruc.strip() not in ["", "9999999999999", "N/A"]:
        query = query.filter(models.Proveedor.identificacion_fiscal == proveedor_ruc.strip())
    elif proveedor_nombre and proveedor_nombre.strip():
        query = query.filter(models.Proveedor.nombre.ilike(f"%{proveedor_nombre.strip()}%"))

    factura_existente = query.first()

    if factura_existente:
        return {
            "existe": True,
            "id": factura_existente.id,
            "numero_factura": factura_existente.numero_factura,
            "proveedor": factura_existente.proveedor.nombre if factura_existente.proveedor else "Proveedor Registrado",
            "fecha_emision": factura_existente.fecha_emision.isoformat() if factura_existente.fecha_emision else "S/F",
            "total": float(factura_existente.total or 0.0)
        }

    return {"existe": False}


# ==========================================
# GUARDADO DE FACTURAS (PRIORIDAD DE CATEGORÍA REAL)
# ==========================================

@app.post("/api/facturas/guardar")
@app.post("/api/facturas")
def guardar_factura(payload: dict, db: Session = Depends(get_db)):
    try:
        nombre_prov = str(payload.get("proveedor_nombre") or "").strip() or "Proveedor General"
        ruc_prov = str(
            payload.get("proveedor_id_fiscal") 
            or payload.get("proveedor_ruc") 
            or "9999999999999"
        ).strip()
        num_factura = str(payload.get("numero_factura") or "").strip()

        if not num_factura:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, 
                detail="El número de comprobante/factura es obligatorio."
            )

        proveedor = db.query(models.Proveedor).filter(
            models.Proveedor.identificacion_fiscal == ruc_prov
        ).first()

        if not proveedor:
            proveedor = models.Proveedor(nombre=nombre_prov, identificacion_fiscal=ruc_prov)
            db.add(proveedor)
            db.flush()
        elif nombre_prov and (not proveedor.nombre or proveedor.nombre == "Proveedor General"):
            proveedor.nombre = nombre_prov

        fecha_emision = date.today()
        f_raw = payload.get("fecha_emision")
        if f_raw:
            try:
                fecha_emision = datetime.strptime(str(f_raw)[:10], "%Y-%m-%d").date()
            except ValueError:
                pass

        b0 = limpiar_float(payload.get("base_iva_0"))
        bg = limpiar_float(payload.get("base_iva_grabada"))
        subt = limpiar_float(payload.get("subtotal"), default=bg)
        iva = limpiar_float(payload.get("impuestos") or payload.get("iva"))
        tot = limpiar_float(payload.get("total"), default=(subt + iva))

        dispositivo_reg = payload.get("dispositivo_origen") or identificar_dispositivo_local()

        factura = db.query(models.Factura).filter(
            models.Factura.proveedor_id == proveedor.id,
            models.Factura.numero_factura == num_factura
        ).first()

        if factura:
            factura.numero_autorizacion = payload.get("numero_autorizacion") or None
            factura.fecha_emision = fecha_emision
            factura.estado_pago = payload.get("estado_pago") or "Pendiente"
            factura.comentario = payload.get("comentario") or None
            factura.base_iva_0 = b0
            factura.base_iva_grabada = bg
            factura.porcentaje_iva = limpiar_float(payload.get("porcentaje_iva"), 15.0)
            factura.descuento_total = limpiar_float(payload.get("descuento_total"))
            factura.subtotal = subt
            factura.impuestos = iva
            factura.total = tot
            factura.dispositivo_origen = dispositivo_reg
            if payload.get("url_factura"):
                factura.url_factura = payload.get("url_factura")
            
            db.query(models.DetalleFactura).filter(models.DetalleFactura.factura_id == factura.id).delete()
        else:
            factura = models.Factura(
                proveedor_id=proveedor.id,
                numero_factura=num_factura,
                numero_autorizacion=payload.get("numero_autorizacion") or None,
                fecha_emision=fecha_emision,
                estado_pago=payload.get("estado_pago") or "Pendiente",
                comentario=payload.get("comentario") or None,
                dispositivo_origen=dispositivo_reg,
                base_iva_0=b0,
                base_iva_grabada=bg,
                porcentaje_iva=limpiar_float(payload.get("porcentaje_iva"), 15.0),
                descuento_total=limpiar_float(payload.get("descuento_total")),
                subtotal=subt,
                impuestos=iva,
                total=tot,
                url_factura=payload.get("url_factura") or None
            )
            db.add(factura)
            db.flush()

        items_payload = payload.get("items", [])
        catalogo_procesado_en_factura = set()

        for item in items_payload:
            desc_raw = str(item.get("descripcion") or "").strip()
            if not desc_raw:
                continue

            cat_enviada = str(item.get("categoria") or "").strip()
            if not cat_enviada:
                cat_enviada = "General"

            es_gasto = cat_enviada.lower() in ["gasto operativo", "envio", "flete", "gasto", "transporte", "servicio"]

            if es_gasto:
                cat_final = "Gasto Operativo"
            else:
                cat_final = cat_enviada
                desc_norm = normalizar_nombre(desc_raw)

                # 1. Buscar si ya existe en la base de datos
                cat_db = db.query(models.CatalogoInsumo).filter(
                    models.CatalogoInsumo.descripcion_normalizada == desc_norm
                ).first()

                if cat_db:
                    # Actualizar categoría si era General o si viene una más específica
                    if cat_final != "General" or cat_db.categoria == "General":
                        cat_db.categoria = cat_final
                    else:
                        cat_final = cat_db.categoria
                else:
                    # 2. Solo insertar si no fue agregado previamente en este mismo lote
                    if desc_norm not in catalogo_procesado_en_factura:
                        nuevo_insumo = models.CatalogoInsumo(
                            descripcion_normalizada=desc_norm,
                            categoria=cat_final
                        )
                        db.add(nuevo_insumo)
                        catalogo_procesado_en_factura.add(desc_norm)

            cant = limpiar_float(item.get("cantidad"), default=1.0)
            pu = limpiar_float(item.get("precio_unitario"))
            dcto = limpiar_float(item.get("porcentaje_descuento"))
            pt = limpiar_float(item.get("subtotal") or item.get("precio_total"), default=(cant * pu * (1 - (dcto / 100.0))))
            lote_txt = str(item.get("lote") or "N/A").strip()

            db.add(models.DetalleFactura(
                factura_id=factura.id,
                descripcion=desc_raw[:450],
                categoria=cat_final,
                lote=lote_txt,
                cantidad=cant,
                precio_unitario=pu,
                porcentaje_descuento=dcto,
                precio_total=pt
            ))

        db.commit()
        db.refresh(factura)
        return {"mensaje": "Factura guardada exitosamente", "id": factura.id}

    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        tb = traceback.format_exc()
        print(f"Error en guardar_factura:\n{tb}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fallo al registrar en base de datos: {str(e)}"
        )


# ==========================================
# ENDPOINTS ANALÍTICOS Y ESTADÍSTICAS POR PERÍODO
# ==========================================

@app.get("/api/estadisticas")
def obtener_estadisticas(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        f_desde = datetime.strptime(desde, "%Y-%m-%d").date() if desde else None
        f_hasta = datetime.strptime(hasta, "%Y-%m-%d").date() if hasta else None

        query = db.query(models.Factura).filter(models.Factura.fecha_emision.isnot(None))
        if f_desde:
            query = query.filter(models.Factura.fecha_emision >= f_desde)
        if f_hasta:
            query = query.filter(models.Factura.fecha_emision <= f_hasta)

        total_gasto = query.with_entities(func.coalesce(func.sum(models.Factura.total), 0.0)).scalar()
        total_facturas = query.count()
        ticket_promedio = (total_gasto / total_facturas) if total_facturas > 0 else 0.0

        top_prov_q = (
            db.query(
                models.Proveedor.nombre.label("proveedor"),
                func.coalesce(func.sum(models.Factura.total), 0.0).label("total")
            )
            .join(models.Factura, models.Factura.proveedor_id == models.Proveedor.id)
            .filter(models.Factura.fecha_emision.isnot(None))
        )
        if f_desde:
            top_prov_q = top_prov_q.filter(models.Factura.fecha_emision >= f_desde)
        if f_hasta:
            top_prov_q = top_prov_q.filter(models.Factura.fecha_emision <= f_hasta)

        top_proveedores = (
            top_prov_q.group_by(models.Proveedor.nombre)
            .order_by(desc("total"))
            .all()
        )

        hoy = date.today()
        primer_dia_mes = date(hoy.year, hoy.month, 1)
        if hoy.month == 12:
            ultimo_dia_mes = date(hoy.year + 1, 1, 1)
        else:
            ultimo_dia_mes = date(hoy.year, hoy.month + 1, 1)

        gasto_mes_actual = (
            db.query(func.coalesce(func.sum(models.Factura.total), 0.0))
            .filter(
                models.Factura.fecha_emision >= primer_dia_mes,
                models.Factura.fecha_emision < ultimo_dia_mes
            )
            .scalar()
        )

        return {
            "total_comprado": float(total_gasto or 0.0),
            "cantidad_facturas": int(total_facturas or 0),
            "ticket_promedio": float(ticket_promedio or 0.0),
            "compromisos_mes": float(gasto_mes_actual or 0.0),
            "top_proveedores": [
                {"proveedor": row.proveedor or "Desconocido", "total": float(row.total)}
                for row in top_proveedores
            ]
        }
    except Exception as e:
        print(f"Error en estadisticas: {e}")
        return {
            "total_comprado": 0.0,
            "cantidad_facturas": 0,
            "ticket_promedio": 0.0,
            "compromisos_mes": 0.0,
            "top_proveedores": []
        }


@app.get("/api/analitica/productos")
def analitica_productos(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        f_desde = datetime.strptime(desde, "%Y-%m-%d").date() if desde else None
        f_hasta = datetime.strptime(hasta, "%Y-%m-%d").date() if hasta else None

        query = (
            db.query(
                models.DetalleFactura.descripcion.label("producto"),
                func.coalesce(models.DetalleFactura.categoria, "General").label("categoria"),
                func.coalesce(func.sum(models.DetalleFactura.cantidad), 0.0).label("unidades"),
                func.coalesce(func.sum(models.DetalleFactura.precio_total), 0.0).label("gasto_total")
            )
            .join(models.Factura, models.Factura.id == models.DetalleFactura.factura_id)
            .filter(models.DetalleFactura.categoria != "Gasto Operativo")
        )

        if f_desde:
            query = query.filter(models.Factura.fecha_emision >= f_desde)
        if f_hasta:
            query = query.filter(models.Factura.fecha_emision <= f_hasta)

        insumos = (
            query.group_by(models.DetalleFactura.descripcion, models.DetalleFactura.categoria)
            .order_by(desc("gasto_total"))
            .all()
        )

        return [
            {
                "producto": item.producto or "General",
                "categoria": item.categoria or "General",
                "unidades": float(item.unidades or 0.0),
                "gasto_total": float(item.gasto_total or 0.0)
            }
            for item in insumos
        ]
    except Exception as e:
        print(f"Error en analitica_productos: {e}")
        return []


@app.get("/api/analitica/flujo-caja")
def analitica_flujo_caja(db: Session = Depends(get_db)):
    try:
        hace_un_ano = date.today().replace(year=date.today().year - 1)
        periodo_expr = func.to_char(models.Factura.fecha_emision, 'YYYY-MM')

        flujo = (
            db.query(
                periodo_expr.label("periodo"),
                func.coalesce(func.sum(models.Factura.total), 0.0).label("monto"),
                func.count(models.Factura.id).label("cantidad_facturas")
            )
            .filter(
                models.Factura.fecha_emision.isnot(None),
                models.Factura.fecha_emision >= hace_un_ano
            )
            .group_by(periodo_expr)
            .order_by(periodo_expr)
            .all()
        )

        historico = [
            {
                "periodo": str(f.periodo),
                "monto": float(f.monto or 0.0),
                "cantidad_facturas": int(f.cantidad_facturas or 0)
            }
            for f in flujo
        ]
        promedio = sum(item["monto"] for item in historico) / len(historico) if historico else 0.0

        return {"historico": historico, "promedio_mensual": float(promedio)}
    except Exception as e:
        print(f"Error en analitica_flujo_caja: {e}")
        return {"historico": [], "promedio_mensual": 0.0}


@app.get("/api/analitica/categorias")
def analitica_categorias(
    desde: Optional[str] = Query(None),
    hasta: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    try:
        f_desde = datetime.strptime(desde, "%Y-%m-%d").date() if desde else None
        f_hasta = datetime.strptime(hasta, "%Y-%m-%d").date() if hasta else None

        query = (
            db.query(
                models.DetalleFactura.categoria.label("categoria"),
                func.coalesce(func.sum(models.DetalleFactura.cantidad), 0.0).label("unidades_totales"),
                func.coalesce(func.sum(models.DetalleFactura.precio_total), 0.0).label("monto_total"),
                func.count(models.DetalleFactura.id).label("conteo_items")
            )
            .join(models.Factura, models.Factura.id == models.DetalleFactura.factura_id)
            .filter(models.DetalleFactura.categoria != "Gasto Operativo")
        )

        if f_desde:
            query = query.filter(models.Factura.fecha_emision >= f_desde)
        if f_hasta:
            query = query.filter(models.Factura.fecha_emision <= f_hasta)

        reporte = (
            query.group_by(models.DetalleFactura.categoria)
            .order_by(desc("monto_total"))
            .all()
        )

        return [
            {
                "categoria": row.categoria or "General",
                "unidades": float(row.unidades_totales),
                "monto": float(row.monto_total),
                "items": int(row.conteo_items)
            }
            for row in reporte
        ]
    except Exception as e:
        print(f"Error en analitica_categorias: {e}")
        return []


# ==========================================
# LISTADO PRINCIPAL DE FACTURAS (CON AUDITORÍA)
# ==========================================

@app.get("/api/facturas/listado")
def listar_facturas_listado(db: Session = Depends(get_db)):
    try:
        facturas_db = (
            db.query(models.Factura)
            .options(joinedload(models.Factura.proveedor), joinedload(models.Factura.items))
            .order_by(desc(models.Factura.fecha_emision))
            .all()
        )

        resultado = []
        for f in facturas_db:
            resultado.append({
                "id": f.id,
                "proveedor_nombre": f.proveedor.nombre if f.proveedor else "Sin Proveedor",
                "proveedor_ruc": f.proveedor.identificacion_fiscal if f.proveedor else "N/A",
                "proveedor": f.proveedor.nombre if f.proveedor else "Sin Proveedor",
                "numero_factura": f.numero_factura,
                "numero_autorizacion": f.numero_autorizacion,
                "fecha_emision": f.fecha_emision.isoformat() if f.fecha_emision else None,
                "created_at": f.created_at.strftime("%d/%m/%Y %H:%M") if getattr(f, "created_at", None) else None,
                "dispositivo_origen": getattr(f, "dispositivo_origen", "Local") or "Local",
                "subtotal": float(f.subtotal or 0.0),
                "descuento_total": float(f.descuento_total or 0.0),
                "base_iva_grabada": float(f.base_iva_grabada or f.subtotal or 0.0),
                "iva": float(f.impuestos or 0.0),
                "impuestos": float(f.impuestos or 0.0),
                "total": float(f.total or 0.0),
                "estado_pago": f.estado_pago or "Pendiente",
                "metodo_pago": f.metodo_pago,
                "fecha_pago": f.fecha_pago.isoformat() if f.fecha_pago else None,
                "comentario": f.comentario or "",
                "items_count": len(f.items) if f.items else 0,
                "url_factura": f.url_factura,
                "url_comprobante_pago": f.url_comprobante_pago,
                "items": [
                    {
                        "id": it.id,
                        "descripcion": it.descripcion,
                        "categoria": it.categoria or "General",
                        "cantidad": float(it.cantidad or 0.0),
                        "precio_unitario": float(it.precio_unitario or 0.0),
                        "subtotal": float(it.precio_total or 0.0),
                        "precio_total": float(it.precio_total or 0.0),
                        "porcentaje_descuento": float(getattr(it, 'porcentaje_descuento', 0.0) or 0.0),
                        "lote": getattr(it, 'lote', 'N/A') or 'N/A'
                    }
                    for it in (f.items or [])
                ]
            })

        return resultado
    except Exception as e:
        print(f"Error en listar_facturas_listado: {e}")
        return []


# ==========================================
# CATÁLOGO MAESTRO (FILTRA GASTOS OPERATIVOS)
# ==========================================

@app.get("/api/productos/catalogo-maestro")
@app.get("/api/catalogo/maestro")
@app.get("/api/insumos/catalogo")
def obtener_catalogo_maestro(db: Session = Depends(get_db)):
    try:
        facturas = (
            db.query(models.Factura)
            .options(joinedload(models.Factura.proveedor), joinedload(models.Factura.items))
            .filter(models.Factura.fecha_emision.isnot(None))
            .order_by(desc(models.Factura.fecha_emision))
            .all()
        )

        agrupados = {}
        for fac in facturas:
            prov_nombre = fac.proveedor.nombre if fac.proveedor else "Proveedor Desconocido"
            f_emision_txt = fac.fecha_emision.isoformat()
            num_fac = fac.numero_factura or "N/A"

            for d in (fac.items or []):
                if str(d.categoria or "").strip().lower() == "gasto operativo":
                    continue

                prod_nombre = str(d.descripcion or "").strip()
                if not prod_nombre:
                    continue

                if prod_nombre not in agrupados:
                    agrupados[prod_nombre] = {
                        "categoria": d.categoria or "General",
                        "compras": []
                    }
                else:
                    # Si tiene una categoría específica, mantenerla sobre General
                    if d.categoria and d.categoria != "General":
                        agrupados[prod_nombre]["categoria"] = d.categoria

                dcto_val = float(getattr(d, 'porcentaje_descuento', 0.0) or 0.0)
                lote_val = getattr(d, 'lote', 'N/A') or 'N/A'

                agrupados[prod_nombre]["compras"].append({
                    "fecha": f_emision_txt,
                    "numero_factura": num_fac,
                    "proveedor": prov_nombre,
                    "lote": lote_val,
                    "cantidad": float(d.cantidad or 0.0),
                    "precio_unitario": float(d.precio_unitario or 0.0),
                    "porcentaje_descuento": dcto_val,
                    "subtotal": float(d.precio_total or 0.0)
                })

        resultado = []
        for prod_nombre, data in agrupados.items():
            hist = data["compras"]
            cat_actual = data["categoria"]

            precios = [h["precio_unitario"] for h in hist if h["precio_unitario"] > 0]
            if not precios:
                precios = [0.0]

            p_min = min(precios)
            p_max = max(precios)
            p_prom = sum(precios) / len(precios)
            ultimo_p = hist[0]["precio_unitario"]

            proveedores_set = list({h["proveedor"] for h in hist})
            compra_min = next((h for h in hist if h["precio_unitario"] == p_min), hist[0])
            mejor_prov = compra_min["proveedor"]

            resultado.append({
                "producto": prod_nombre,
                "nombre": prod_nombre,
                "descripcion": prod_nombre,
                "categoria": cat_actual,
                "proveedores": proveedores_set,
                "mejor_proveedor": mejor_prov,
                "total_compras": len(hist),
                "unidades_totales": sum(h["cantidad"] for h in hist),
                "ultimo_precio": float(ultimo_p),
                "precio_min": float(p_min),
                "precio_max": float(p_max),
                "precio_promedio": round(float(p_prom), 2),
                "historial": hist
            })

        resultado.sort(key=lambda x: x["producto"].lower())
        return resultado
    except Exception as e:
        print(f"Error generando catálogo maestro: {e}")
        return []


# ==========================================
# BÚSQUEDA REACTIVA DE PRODUCTOS
# ==========================================

@app.get("/api/productos/buscar")
def buscar_productos(q: str = Query("", min_length=1), db: Session = Depends(get_db)):
    try:
        query_txt = q.strip().lower()
        catalogo = obtener_catalogo_maestro(db)

        if not query_txt:
            return {"total_coincidencias": 0, "productos_agrupados": []}

        coincidencias = [
            p for p in catalogo 
            if query_txt in p["producto"].lower() 
            or any(query_txt in prov.lower() for prov in p["proveedores"])
        ]

        return {
            "total_coincidencias": len(coincidencias),
            "productos_agrupados": coincidencias
        }
    except Exception as e:
        print(f"Error en buscar_productos: {e}")
        return {"total_coincidencias": 0, "productos_agrupados": []}


# ==========================================
# SUGERENCIAS DE CATÁLOGO (DATALIST LIMPIO)
# ==========================================

@app.get("/api/catalogo/sugerencias")
def sugerencias_catalogo(q: str = Query("", min_length=1), db: Session = Depends(get_db)):
    termino = q.strip().lower()
    if not termino:
        return []

    coincidencias = (
        db.query(models.CatalogoInsumo)
        .filter(
            models.CatalogoInsumo.categoria != "Gasto Operativo",
            models.CatalogoInsumo.descripcion_normalizada.ilike(f"%{termino}%")
        )
        .limit(10)
        .all()
    )

    return [
        {
            "descripcion": c.descripcion_normalizada.title(),
            "categoria": c.categoria
        }
        for c in coincidencias
    ]


# ==========================================
# FUSIÓN DE PRODUCTOS DUPLICADOS
# ==========================================

@app.post("/api/catalogo/fusionar")
def fusionar_productos_catalogo(payload: dict, db: Session = Depends(get_db)):
    nombre_principal = str(payload.get("nombre_principal", "")).strip()
    nombre_secundario = str(payload.get("nombre_secundario", "")).strip()

    if not nombre_principal or not nombre_secundario or nombre_principal.lower() == nombre_secundario.lower():
        raise HTTPException(status_code=400, detail="Debes indicar dos productos distintos para fusionar.")

    norm_principal = normalizar_nombre(nombre_principal)
    norm_secundario = normalizar_nombre(nombre_secundario)

    item_principal = db.query(models.CatalogoInsumo).filter(
        models.CatalogoInsumo.descripcion_normalizada == norm_principal
    ).first()

    cat_destino = item_principal.categoria if (item_principal and item_principal.categoria != "General") else "General"

    lineas_afectadas = db.query(models.DetalleFactura).filter(
        func.lower(models.DetalleFactura.descripcion) == norm_secundario
    ).update({
        "descripcion": nombre_principal,
        "categoria": cat_destino
    }, synchronize_session=False)

    db.query(models.CatalogoInsumo).filter(
        models.CatalogoInsumo.descripcion_normalizada == norm_secundario
    ).delete(synchronize_session=False)

    db.commit()

    return {
        "mensaje": f"Se unificaron {lineas_afectadas} compras bajo '{nombre_principal}' con éxito.",
        "lineas_actualizadas": lineas_afectadas
    }


# ==========================================
# GESTIÓN DE ACCIONES, EDICIÓN, CATEGORÍAS Y ARCHIVOS
# ==========================================

@app.put("/api/insumos/cambiar-categoria")
def cambiar_categoria(payload: dict, db: Session = Depends(get_db)):
    descripcion = payload.get("descripcion", "").strip()
    nueva_categoria = payload.get("nueva_categoria", "General").strip()
    nombre_norm = normalizar_nombre(descripcion)

    if not descripcion:
        raise HTTPException(status_code=400, detail="Descripción requerida")

    reg = db.query(models.CatalogoInsumo).filter(
        models.CatalogoInsumo.descripcion_normalizada == nombre_norm
    ).first()

    if reg:
        reg.categoria = nueva_categoria
    else:
        db.add(models.CatalogoInsumo(
            descripcion_normalizada=nombre_norm,
            categoria=nueva_categoria
        ))

    db.query(models.DetalleFactura).filter(
        models.DetalleFactura.descripcion.ilike(f"%{descripcion}%")
    ).update({"categoria": nueva_categoria}, synchronize_session=False)

    db.commit()
    return {"mensaje": f"Categoría de '{descripcion}' actualizada a '{nueva_categoria}' con éxito."}


@app.patch("/api/facturas/{factura_id}/subir-archivo")
async def adjuntar_archivo_a_factura(
    factura_id: int, 
    files: List[UploadFile] = File(...), 
    db: Session = Depends(get_db)
):
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    urls_existentes = [u.strip() for u in (factura.url_factura or "").split(",") if u.strip()]

    for f in files:
        contenido = await f.read()
        url_nueva = subir_comprobante_a_nube(contenido, f.filename, carpeta="facturas")
        if url_nueva:
            urls_existentes.append(url_nueva)

    if not urls_existentes:
        raise HTTPException(status_code=500, detail="No se pudo subir ningún comprobante.")

    factura.url_factura = ",".join(urls_existentes)
    db.commit()
    return {"mensaje": "Comprobante(s) vinculado(s) exitosamente", "url_factura": factura.url_factura}


@app.patch("/api/facturas/{factura_id}/estado-pago")
def actualizar_estado_pago(factura_id: int, payload: dict, db: Session = Depends(get_db)):
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    if "estado_pago" in payload:
        factura.estado_pago = payload["estado_pago"]
    if "comentario" in payload:
        factura.comentario = payload["comentario"]

    db.commit()
    return {"mensaje": "Estado actualizado con éxito"}


@app.put("/api/facturas/{factura_id}")
def editar_factura(factura_id: int, payload: dict, db: Session = Depends(get_db)):
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    if payload.get("numero_factura"):
        factura.numero_factura = str(payload["numero_factura"]).strip()
    if payload.get("fecha_emision"):
        try:
            factura.fecha_emision = datetime.strptime(str(payload["fecha_emision"])[:10], "%Y-%m-%d").date()
        except ValueError:
            pass

    items_actualizados = payload.get("items", [])
    if items_actualizados:
        db.query(models.DetalleFactura).filter(models.DetalleFactura.factura_id == factura.id).delete()
        nuevo_subtotal = 0.0

        for it in items_actualizados:
            descrip = str(it.get("descripcion") or "").strip()
            if not descrip:
                continue
            cat = str(it.get("categoria") or "General").strip()
            cant = limpiar_float(it.get("cantidad"), default=1.0)
            pu = limpiar_float(it.get("precio_unitario"))
            dcto = limpiar_float(it.get("porcentaje_descuento"))
            sub = cant * pu * (1 - (dcto / 100.0))
            nuevo_subtotal += sub

            db.add(models.DetalleFactura(
                factura_id=factura.id,
                descripcion=descrip[:450],
                categoria=cat,
                lote=str(it.get("lote") or "N/A"),
                cantidad=cant,
                precio_unitario=pu,
                porcentaje_descuento=dcto,
                precio_total=sub
            ))

        factura.subtotal = nuevo_subtotal
        factura.base_iva_grabada = nuevo_subtotal
        factura.impuestos = round(nuevo_subtotal * 0.15, 2)
        factura.total = round(nuevo_subtotal + factura.impuestos, 2)

    db.commit()
    return {"mensaje": "Factura actualizada exitosamente"}


@app.delete("/api/facturas/{factura_id}")
def eliminar_factura(factura_id: int, db: Session = Depends(get_db)):
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    db.delete(factura)
    db.commit()
    return {"mensaje": "Factura eliminada correctamente"}