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
from sqlalchemy import func, desc, text
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

def limpiar_fecha(val) -> Optional[date]:
    if not val:
        return None
    val_str = str(val).strip()
    if val_str.lower() in ["", "null", "none", "n/a", "s/f"]:
        return None
    try:
        return datetime.strptime(val_str[:10], "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None

def identificar_dispositivo_local() -> str:
    usuario_env = os.getenv("DEVICE_IDENTIFIER") or os.getenv("CLINICA_USUARIO")
    if usuario_env:
        return usuario_env.strip()
    try:
        user = getpass.getuser()
        return user.capitalize()
    except Exception:
        return "Usuario"


# ==============================================================
# VERSIÓN LOCAL OFICIAL DE ESCRITORIO
# ==============================================================
VERSION_LOCAL_DESKTOP_CODIGO = 6
VERSION_LOCAL_DESKTOP_NOMBRE = "1.6.0"

@app.get("/api/sistema/info")
def obtener_info_sistema():
    return {
        "version_codigo": VERSION_LOCAL_DESKTOP_CODIGO,
        "version_nombre": VERSION_LOCAL_DESKTOP_NOMBRE,
        "app_nombre": "Mobadent Invoices"
    }

@app.get("/api/actualizaciones/comprobar")
def comprobar_actualizacion_desktop(db: Session = Depends(get_db)):
    try:
        sql = text("""
            SELECT version_codigo, version_nombre, novedades, url_apk, es_obligatoria
            FROM app_versiones
            WHERE plataforma = 'desktop'
            ORDER BY version_codigo DESC
            LIMIT 1;
        """)
        resultado = db.execute(sql).fetchone()
        
        if not resultado:
            return {"hay_actualizacion": False}
        
        v_codigo, v_nombre, novedades, url_descarga, es_obligatoria = resultado
        
        if int(v_codigo) > VERSION_LOCAL_DESKTOP_CODIGO:
            return {
                "hay_actualizacion": True,
                "version_servidor": v_nombre,
                "codigo_servidor": v_codigo,
                "novedades": novedades,
                "url_descarga": url_descarga,
                "es_obligatoria": bool(es_obligatoria)
            }
        
        return {"hay_actualizacion": False}
    except Exception as e:
        print("Aviso al comprobar actualización de escritorio:", e)
        return {"hay_actualizacion": False}


# ==========================================
# ENDPOINT DE ANÁLISIS MULTI-HOJA CON IA Y SUBIDA A SUPABASE
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

        # ==========================================
        # 🔍 DIAGNÓSTICO EN CONSOLA (MIRA TU TERMINAL)
        # ==========================================
        print("\n" + "="*50)
        print(">>> RESPUESTA PURA DE GEMINI A LOS ITEMS:")
        for idx, item in enumerate(datos.get("items", [])):
            print(f"[{idx+1}] {item.get('descripcion')} | Lote: {item.get('lote')} | Caducidad: {item.get('fecha_caducidad')}")
        print("="*50 + "\n")

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
        .filter(func.trim(models.Factura.numero_factura).ilike(f"%{num_limpio}%"))
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
# GUARDADO DE FACTURAS CON RESPALDO DE TOTAL
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
        tot = limpiar_float(payload.get("total"))

        items_payload = payload.get("items", [])
        if tot <= 0.0 and len(items_payload) > 0:
            subt_calc = sum(
                limpiar_float(it.get("cantidad", 1)) * limpiar_float(it.get("precio_unitario", 0)) * (1 - (limpiar_float(it.get("porcentaje_descuento", 0)) / 100.0))
                for it in items_payload
            )
            subt = subt_calc
            iva = round(subt * 0.15, 2)
            tot = round(subt + iva, 2)

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

                cat_db = db.query(models.CatalogoInsumo).filter(
                    models.CatalogoInsumo.descripcion_normalizada == desc_norm
                ).first()

                if cat_db:
                    if cat_final != "General" or cat_db.categoria == "General":
                        cat_db.categoria = cat_final
                    else:
                        cat_final = cat_db.categoria
                else:
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
            fecha_cad = limpiar_fecha(item.get("fecha_caducidad"))

            detalle_kwargs = {
                "factura_id": factura.id,
                "descripcion": desc_raw[:450],
                "categoria": cat_final,
                "lote": lote_txt,
                "cantidad": cant,
                "precio_unitario": pu,
                "porcentaje_descuento": dcto,
                "precio_total": pt
            }
            if hasattr(models.DetalleFactura, "fecha_caducidad"):
                detalle_kwargs["fecha_caducidad"] = fecha_cad

            db.add(models.DetalleFactura(**detalle_kwargs))

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
# GESTIÓN Y SUBIDA DE COMPROBANTES POST-REGISTRO
# ==========================================
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
        else:
            raise HTTPException(status_code=500, detail="Error al subir el archivo a Supabase Storage.")

    factura.url_factura = ",".join(urls_existentes)
    db.commit()
    db.refresh(factura)
    return {"mensaje": "Comprobante(s) vinculado(s) exitosamente", "url_factura": factura.url_factura}


# ==========================================
# ENDPOINTS ANALÍTICOS Y LISTADOS
# ==========================================
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
            items_formateados = []
            for it in (f.items or []):
                cad_val = getattr(it, 'fecha_caducidad', None)
                cad_str = cad_val.isoformat() if isinstance(cad_val, (date, datetime)) else (str(cad_val) if cad_val else None)
                
                items_formateados.append({
                    "id": it.id,
                    "descripcion": it.descripcion,
                    "categoria": it.categoria or "General",
                    "cantidad": float(it.cantidad or 0.0),
                    "precio_unitario": float(it.precio_unitario or 0.0),
                    "subtotal": float(it.precio_total or 0.0),
                    "precio_total": float(it.precio_total or 0.0),
                    "porcentaje_descuento": float(getattr(it, 'porcentaje_descuento', 0.0) or 0.0),
                    "lote": getattr(it, 'lote', 'N/A') or 'N/A',
                    "fecha_caducidad": cad_str
                })

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
                "items": items_formateados
            })

        return resultado
    except Exception as e:
        print(f"Error en listar_facturas_listado: {e}")
        return []


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
                    if d.categoria and d.categoria != "General":
                        agrupados[prod_nombre]["categoria"] = d.categoria

                dcto_val = float(getattr(d, 'porcentaje_descuento', 0.0) or 0.0)
                lote_val = getattr(d, 'lote', 'N/A') or 'N/A'
                cad_val = getattr(d, 'fecha_caducidad', None)
                cad_str = cad_val.isoformat() if isinstance(cad_val, (date, datetime)) else (str(cad_val) if cad_val else None)

                agrupados[prod_nombre]["compras"].append({
                    "fecha": f_emision_txt,
                    "numero_factura": num_fac,
                    "proveedor": prov_nombre,
                    "lote": lote_val,
                    "fecha_caducidad": cad_str,
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
            fecha_cad = limpiar_fecha(it.get("fecha_caducidad"))

            detalle_kwargs = {
                "factura_id": factura.id,
                "descripcion": descrip[:450],
                "categoria": cat,
                "lote": str(it.get("lote") or "N/A"),
                "cantidad": cant,
                "precio_unitario": pu,
                "porcentaje_descuento": dcto,
                "precio_total": sub
            }
            if hasattr(models.DetalleFactura, "fecha_caducidad"):
                detalle_kwargs["fecha_caducidad"] = fecha_cad

            db.add(models.DetalleFactura(**detalle_kwargs))

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