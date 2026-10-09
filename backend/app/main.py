import os
import sys
import io
import csv
import logging
from typing import List, Optional
from datetime import datetime, date

from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func, desc, or_
from dotenv import load_dotenv

# Cargar .env tanto en local como dentro del paquete empaquetado
base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
env_path = os.path.join(base_dir, ".env")
if os.path.exists(env_path):
    load_dotenv(env_path)
else:
    load_dotenv()

from app.database import engine, get_db, Base
from app.models import Factura, DetalleFactura, Proveedor, ProductoPVP, VentaPOS, DetalleVentaPOS
from app.ai_extractor import extraer_datos_factura
from app.storage import subir_archivo_supabase

Base.metadata.create_all(bind=engine)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("mobadent-api")

app = FastAPI(title="Mobadent ERP & POS", version="2.5.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PALABRAS_FLETE = ["flete", "envio", "envío", "transporte", "flete local", "guia", "guía"]

class ItemDetalleIn(BaseModel):
    descripcion: str
    categoria: Optional[str] = "General"
    lote: Optional[str] = "N/A"
    cantidad: float = 1.0
    precio_unitario: float = 0.0
    porcentaje_descuento: Optional[float] = 0.0
    precio_total: Optional[float] = 0.0
    fecha_caducidad: Optional[str] = None
    producto_pvp_id: Optional[int] = None

class FacturaCrearIn(BaseModel):
    proveedor: str
    numero_factura: str
    fecha_emision: Optional[str] = None
    total: float
    subtotal: Optional[float] = 0.0
    impuestos: Optional[float] = 0.0
    estado_pago: Optional[str] = "Pendiente"
    comentario: Optional[str] = ""
    url_factura: Optional[str] = ""
    items: List[ItemDetalleIn] = []
    impactar_stock_pvp: Optional[bool] = False

class EstadoPagoUpdate(BaseModel):
    estado_pago: Optional[str] = None
    comentario: Optional[str] = None

class CategoriaUpdate(BaseModel):
    descripcion: str
    nueva_categoria: str

class ItemSincronizacion(BaseModel):
    descripcion: str
    cantidad: float
    precio_unitario: float
    codigo_barras: Optional[str] = None
    categoria: Optional[str] = "General"

class SyncFacturaStockPayload(BaseModel):
    items: List[ItemSincronizacion]

class LineaVentaIn(BaseModel):
    producto_id: Optional[int] = None
    cantidad: float = 1.0
    precio_unitario: float = 0.0
    total: float = 0.0

class VentaCobroIn(BaseModel):
    metodo_pago: str = "Cash"
    monto_recibido: float = 0.0
    cambio: float = 0.0
    subtotal: float = 0.0
    impuestos: float = 0.0
    total: float = 0.0
    items: List[LineaVentaIn] = []

class VentaEditarIn(BaseModel):
    metodo_pago: Optional[str] = None
    monto_recibido: Optional[float] = None
    cambio: Optional[float] = None

# ---------------------------------------------------------
# FACTURAS Y EXTRACCIÓN
# ---------------------------------------------------------
@app.post("/api/facturas/extraer")
async def procesar_extraccion_factura(
    files: Optional[List[UploadFile]] = File(None),
    file: Optional[UploadFile] = File(None)
):
    lista_archivos = []
    if files:
        lista_archivos.extend(files)
    if file:
        lista_archivos.append(file)

    if not lista_archivos:
        raise HTTPException(status_code=400, detail="No se enviaron archivos válidos para procesar.")

    try:
        resultado = await extraer_datos_factura(lista_archivos)
        return resultado
    except Exception as e:
        logger.error(f"Error procesando factura con IA: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fallo en motor de extracción: {str(e)}")

@app.post("/api/facturas/guardar")
def guardar_factura_completa(datos: FacturaCrearIn, db: Session = Depends(get_db)):
    try:
        nombre_prov = datos.proveedor.strip()
        prov = db.query(Proveedor).filter(func.lower(Proveedor.nombre) == nombre_prov.lower()).first()
        if not prov:
            prov = Proveedor(nombre=nombre_prov)
            db.add(prov)
            db.flush()

        fecha_val = None
        if datos.fecha_emision:
            try:
                fecha_val = datetime.strptime(datos.fecha_emision[:10], "%Y-%m-%d").date()
            except Exception:
                fecha_val = None

        nueva_fac = Factura(
            proveedor_id=prov.id,
            numero_factura=datos.numero_factura.strip(),
            fecha_emision=fecha_val,
            total=datos.total,
            subtotal=datos.subtotal,
            impuestos=datos.impuestos,
            estado_pago=datos.estado_pago or "Pendiente",
            comentario=datos.comentario or "",
            url_factura=datos.url_factura or ""
        )
        db.add(nueva_fac)
        db.flush()

        for item in datos.items:
            f_cad = None
            if item.fecha_caducidad:
                try:
                    f_cad = datetime.strptime(item.fecha_caducidad[:10], "%Y-%m-%d").date()
                except Exception:
                    f_cad = None

            # Cálculo financiero: Costo Unitario Neto Real aplicando el % de Descuento
            desc_pct = float(item.porcentaje_descuento or 0.0)
            factor_desc = 1.0 - (desc_pct / 100.0)
            costo_unitario_neto = round(float(item.precio_unitario) * factor_desc, 2)

            total_linea = item.precio_total
            if not total_linea or total_linea == 0:
                total_linea = round(float(item.cantidad) * costo_unitario_neto, 2)

            nombre_item_limpio = " ".join(item.descripcion.strip().split())
            desc_lower = nombre_item_limpio.lower()
            cat_lower = (item.categoria or "").strip().lower()
            es_gasto = cat_lower == "gasto operativo" or any(p in desc_lower for p in PALABRAS_FLETE)

            prod_pvp = None
            if not es_gasto:
                prod_pvp = db.query(ProductoPVP).filter(
                    func.lower(func.trim(ProductoPVP.nombre)) == desc_lower
                ).first()

                if datos.impactar_stock_pvp:
                    cant_u = float(item.cantidad)
                    if prod_pvp:
                        # 1. Sumar existencias físicas al mostrador
                        prod_pvp.stock_actual = float(prod_pvp.stock_actual or 0) + cant_u
                        
                        # 2. Actualizar el costo referencial al costo NETO REAL pagado
                        if costo_unitario_neto > 0:
                            prod_pvp.costo_referencial = costo_unitario_neto
                            # Si no tenía PVP o el PVP era inferior al costo, sugerir 35% de margen
                            if float(prod_pvp.pvp or 0) <= costo_unitario_neto:
                                prod_pvp.pvp = round(costo_unitario_neto * 1.35, 2)
                    else:
                        # Producto nuevo: PVP sugerido calculado sobre el costo real neto
                        pvp_sug = round(costo_unitario_neto * 1.35, 2) if costo_unitario_neto > 0 else 0.0
                        prod_pvp = ProductoPVP(
                            nombre=nombre_item_limpio,
                            categoria=item.categoria or "General",
                            stock_actual=cant_u,
                            costo_referencial=costo_unitario_neto,
                            pvp=pvp_sug
                        )
                        db.add(prod_pvp)
                        db.flush()

            det = DetalleFactura(
                factura_id=nueva_fac.id,
                descripcion=nombre_item_limpio,
                categoria=item.categoria or "General",
                lote=item.lote or "N/A",
                cantidad=item.cantidad,
                precio_unitario=item.precio_unitario,
                porcentaje_descuento=desc_pct,
                precio_total=total_linea,
                fecha_caducidad=f_cad,
                producto_pvp_id=prod_pvp.id if prod_pvp else None
            )
            db.add(det)

        db.commit()
        return {"status": "ok", "factura_id": nueva_fac.id, "mensaje": "Factura guardada correctamente"}

    except Exception as e:
        db.rollback()
        logger.error(f"Error registrando factura: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fallo al registrar en base de datos: {str(e)}")

@app.get("/api/facturas/listado")
def listar_facturas(db: Session = Depends(get_db)):
    facturas = (
        db.query(Factura)
        .options(joinedload(Factura.detalles), joinedload(Factura.proveedor_rel))
        .order_by(desc(Factura.fecha_emision), desc(Factura.id))
        .all()
    )
    resultado = []
    for f in facturas:
        prov_nombre = f.proveedor_rel.nombre if f.proveedor_rel else "Proveedor Desconocido"
        items_list = []
        for d in f.detalles:
            items_list.append({
                "id": d.id,
                "descripcion": d.descripcion,
                "categoria": d.categoria or "General",
                "lote": d.lote or "N/A",
                "cantidad": float(d.cantidad or 0),
                "precio_unitario": float(d.precio_unitario or 0),
                "porcentaje_descuento": float(d.porcentaje_descuento or 0),
                "precio_total": float(d.precio_total or 0),
                "fecha_caducidad": d.fecha_caducidad.isoformat() if d.fecha_caducidad else None,
                "producto_pvp_id": d.producto_pvp_id
            })
        resultado.append({
            "id": f.id,
            "numero_factura": f.numero_factura,
            "fecha_emision": f.fecha_emision.isoformat() if f.fecha_emision else None,
            "total": float(f.total or 0),
            "subtotal": float(f.subtotal or 0),
            "impuestos": float(f.impuestos or 0),
            "estado_pago": f.estado_pago or "Pendiente",
            "comentario": f.comentario or "",
            "url_factura": f.url_factura or "",
            "proveedor": prov_nombre,
            "items": items_list
        })
    return resultado

@app.patch("/api/facturas/{id}/estado-pago")
def cambiar_estado_o_nota(id: int, payload: EstadoPagoUpdate, db: Session = Depends(get_db)):
    fac = db.query(Factura).filter(Factura.id == id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    if payload.estado_pago is not None:
        fac.estado_pago = payload.estado_pago
    if payload.comentario is not None:
        fac.comentario = payload.comentario
    db.commit()
    return {"status": "ok", "factura_id": fac.id}

@app.put("/api/facturas/{id}")
def actualizar_factura_completa(id: int, payload: FacturaCrearIn, db: Session = Depends(get_db)):
    fac = db.query(Factura).filter(Factura.id == id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    try:
        prov = db.query(Proveedor).filter(func.lower(Proveedor.nombre) == payload.proveedor.strip().lower()).first()
        if not prov:
            prov = Proveedor(nombre=payload.proveedor.strip())
            db.add(prov)
            db.flush()

        fecha_val = None
        if payload.fecha_emision:
            try:
                fecha_val = datetime.strptime(payload.fecha_emision[:10], "%Y-%m-%d").date()
            except Exception:
                fecha_val = None

        fac.proveedor_id = prov.id
        fac.numero_factura = payload.numero_factura.strip()
        fac.fecha_emision = fecha_val
        fac.total = payload.total
        fac.subtotal = payload.subtotal
        fac.impuestos = payload.impuestos
        if payload.estado_pago:
            fac.estado_pago = payload.estado_pago
        if payload.comentario is not None:
            fac.comentario = payload.comentario

        db.query(DetalleFactura).filter(DetalleFactura.factura_id == fac.id).delete()
        for item in payload.items:
            f_cad = None
            if item.fecha_caducidad:
                try:
                    f_cad = datetime.strptime(item.fecha_caducidad[:10], "%Y-%m-%d").date()
                except Exception:
                    f_cad = None

            desc_pct = float(item.porcentaje_descuento or 0.0)
            factor_desc = 1.0 - (desc_pct / 100.0)
            costo_neto = round(float(item.precio_unitario) * factor_desc, 2)
            total_linea = item.precio_total or round(float(item.cantidad) * costo_neto, 2)

            det = DetalleFactura(
                factura_id=fac.id,
                descripcion=item.descripcion.strip(),
                categoria=item.categoria or "General",
                lote=item.lote or "N/A",
                cantidad=item.cantidad,
                precio_unitario=item.precio_unitario,
                porcentaje_descuento=desc_pct,
                precio_total=total_linea,
                fecha_caducidad=f_cad
            )
            db.add(det)

        db.commit()
        return {"status": "ok", "factura_id": fac.id}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/api/facturas/{id}")
def eliminar_factura(id: int, revertir_stock: bool = Query(False), db: Session = Depends(get_db)):
    fac = db.query(Factura).filter(Factura.id == id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    if revertir_stock:
        for det in fac.detalles:
            prod = None
            if det.producto_pvp_id:
                prod = db.query(ProductoPVP).filter(ProductoPVP.id == det.producto_pvp_id).first()
            if not prod:
                nom_limpio = " ".join(det.descripcion.strip().split()).lower()
                prod = db.query(ProductoPVP).filter(func.lower(func.trim(ProductoPVP.nombre)) == nom_limpio).first()

            if prod:
                nuevo_stock = float(prod.stock_actual or 0) - float(det.cantidad or 0)
                if nuevo_stock <= 0:
                    db.delete(prod)
                else:
                    prod.stock_actual = nuevo_stock

    db.query(DetalleFactura).filter(DetalleFactura.factura_id == id).delete()
    db.delete(fac)
    db.commit()
    return {"status": "ok", "mensaje": "Factura eliminada correctamente"}

@app.patch("/api/facturas/{id}/subir-archivo")
async def adjuntar_archivos_factura(id: int, files: List[UploadFile] = File(...), db: Session = Depends(get_db)):
    fac = db.query(Factura).filter(Factura.id == id).first()
    if not fac:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    urls_subidas = []
    for f in files:
        url = await subir_archivo_supabase(f)
        if url:
            urls_subidas.append(url)
    if urls_subidas:
        existentes = [u.strip() for u in (fac.url_factura or "").split(",") if u.strip()]
        total_urls = existentes + urls_subidas
        fac.url_factura = ",".join(total_urls)
        db.commit()
    return {"status": "ok", "url_factura": fac.url_factura}

# ---------------------------------------------------------
# HISTORIAL DE COSTOS Y CATÁLOGO
# ---------------------------------------------------------
@app.get("/api/productos/catalogo-maestro")
def catalogo_maestro(db: Session = Depends(get_db)):
    detalles = (
        db.query(DetalleFactura)
        .join(Factura)
        .join(Proveedor)
        .filter(or_(DetalleFactura.categoria.is_(None), DetalleFactura.categoria != "Gasto Operativo"))
        .all()
    )
    grupos = {}
    for d in detalles:
        nom = d.descripcion.strip()
        if nom not in grupos:
            grupos[nom] = {
                "producto": nom,
                "categoria": d.categoria or "General",
                "compras": []
            }
        f_emision = d.factura.fecha_emision.isoformat() if d.factura and d.factura.fecha_emision else "S/F"
        p_nombre = d.factura.proveedor_rel.nombre if (d.factura and d.factura.proveedor_rel) else "Desconocido"
        grupos[nom]["compras"].append({
            "fecha": f_emision,
            "proveedor": p_nombre,
            "factura": d.factura.numero_factura if d.factura else "S/N",
            "precio": float(d.precio_unitario or 0),
            "cantidad": float(d.cantidad or 0),
            "descuento": float(d.porcentaje_descuento or 0)
        })

    res = []
    for nom, datos in grupos.items():
        compras = datos["compras"]
        precios = [c["precio"] for c in compras if c["precio"] > 0]
        p_min = min(precios) if precios else 0.0
        p_max = max(precios) if precios else 0.0
        p_prom = round(sum(precios) / len(precios), 2) if precios else 0.0
        mejor_prov = "N/A"
        for c in compras:
            if c["precio"] == p_min:
                mejor_prov = c["proveedor"]
                break
        res.append({
            "producto": nom,
            "categoria": datos["categoria"],
            "total_compras": len(compras),
            "unidades_totales": sum(c["cantidad"] for c in compras),
            "precio_min": p_min,
            "precio_max": p_max,
            "precio_promedio": p_prom,
            "mejor_proveedor": mejor_prov,
            "historial": sorted(compras, key=lambda x: x["fecha"], reverse=True)
        })
    res.sort(key=lambda x: x["producto"].lower())
    return res

@app.put("/api/insumos/cambiar-categoria")
def cambiar_categoria_insumo(payload: CategoriaUpdate, db: Session = Depends(get_db)):
    db.query(DetalleFactura).filter(
        func.lower(DetalleFactura.descripcion) == payload.descripcion.strip().lower()
    ).update({"categoria": payload.nueva_categoria}, synchronize_session=False)
    db.commit()
    return {"status": "ok"}

@app.get("/api/analitica/flujo-caja")
def obtener_flujo_caja(db: Session = Depends(get_db)):
    facturas = db.query(Factura).filter(Factura.fecha_emision.isnot(None)).order_by(Factura.fecha_emision.asc()).all()
    meses = {}
    for f in facturas:
        mes_key = f.fecha_emision.strftime("%Y-%m")
        meses[mes_key] = meses.get(mes_key, 0.0) + float(f.total or 0)
    historico = [{"mes": k, "total": round(v, 2)} for k, v in sorted(meses.items())]
    prom = round(sum(m["total"] for m in historico) / len(historico), 2) if historico else 0.0
    return {"historico": historico, "promedio_mensual": prom}

# ---------------------------------------------------------
# INVENTARIO COMERCIAL PVP
# ---------------------------------------------------------
@app.get("/api/pvp/listado")
def listar_productos_pvp(db: Session = Depends(get_db)):
    return db.query(ProductoPVP).filter(ProductoPVP.activo == True).order_by(ProductoPVP.nombre.asc()).all()

@app.post("/api/pvp/guardar")
def guardar_o_actualizar_producto_pvp(payload: dict, db: Session = Depends(get_db)):
    prod_id = payload.get("id")
    if prod_id:
        prod = db.query(ProductoPVP).filter(ProductoPVP.id == prod_id).first()
        if not prod:
            raise HTTPException(status_code=404, detail="Producto no encontrado")
    else:
        prod = ProductoPVP()
        db.add(prod)

    prod.codigo_barras = payload.get("codigo_barras") or None
    prod.nombre = payload.get("nombre", "").strip()
    prod.categoria = payload.get("categoria", "General")
    prod.stock_actual = float(payload.get("stock_actual", 0))
    prod.costo_referencial = float(payload.get("costo_referencial", 0))
    prod.pvp = float(payload.get("pvp", 0))

    db.commit()
    db.refresh(prod)
    return prod

@app.patch("/api/pvp/{id}/stock")
def ajustar_stock_pvp(id: int, payload: dict, db: Session = Depends(get_db)):
    prod = db.query(ProductoPVP).filter(ProductoPVP.id == id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    delta = float(payload.get("delta", 0))
    nuevo_stock = float(prod.stock_actual or 0) + delta
    prod.stock_actual = max(0.0, nuevo_stock)
    db.commit()
    return {"id": prod.id, "nuevo_stock": float(prod.stock_actual)}

@app.patch("/api/pvp/{id}/precio-rapido")
def actualizar_precio_pvp_rapido(id: int, payload: dict, db: Session = Depends(get_db)):
    prod = db.query(ProductoPVP).filter(ProductoPVP.id == id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    
    if "pvp" in payload:
        prod.pvp = float(payload["pvp"])
    if "costo_referencial" in payload:
        prod.costo_referencial = float(payload["costo_referencial"])
    
    db.commit()
    return {"id": prod.id, "pvp": float(prod.pvp), "costo": float(prod.costo_referencial)}

@app.delete("/api/pvp/{id}")
def eliminar_producto_pvp_directo(id: int, db: Session = Depends(get_db)):
    prod = db.query(ProductoPVP).filter(ProductoPVP.id == id).first()
    if not prod:
        raise HTTPException(status_code=404, detail="Producto no encontrado")
    db.query(DetalleFactura).filter(DetalleFactura.producto_pvp_id == id).update({"producto_pvp_id": None})
    db.delete(prod)
    db.commit()
    return {"status": "ok", "mensaje": "Producto eliminado del inventario comercial"}

@app.post("/api/pvp/limpiar-agotados")
def limpiar_agotados_pvp(db: Session = Depends(get_db)):
    eliminados = db.query(ProductoPVP).filter(ProductoPVP.stock_actual <= 0).delete(synchronize_session=False)
    db.commit()
    return {"status": "ok", "eliminados": eliminados}

@app.post("/api/pvp/sincronizar-factura")
def sincronizar_factura_con_stock(payload: SyncFacturaStockPayload, db: Session = Depends(get_db)):
    afectados = 0
    creados = 0
    for it in payload.items:
        nombre_limpio = it.descripcion.strip()
        cat_limpia = (it.categoria or "").strip().lower()

        if cat_limpia == "gasto operativo" or any(p in nombre_limpio.lower() for p in PALABRAS_FLETE):
            continue

        prod = None
        if it.codigo_barras:
            prod = db.query(ProductoPVP).filter(ProductoPVP.codigo_barras == it.codigo_barras).first()
        if not prod:
            prod = db.query(ProductoPVP).filter(func.lower(func.trim(ProductoPVP.nombre)) == nombre_limpio.lower()).first()

        costo_u = float(it.precio_unitario)
        cant_u = float(it.cantidad)

        if prod:
            prod.stock_actual = float(prod.stock_actual or 0) + cant_u
            if costo_u > 0:
                prod.costo_referencial = costo_u
                if float(prod.pvp or 0) <= costo_u:
                    prod.pvp = round(costo_u * 1.35, 2)
            afectados += 1
        else:
            pvp_sug = round(costo_u * 1.35, 2) if costo_u > 0 else 0.0
            nuevo = ProductoPVP(
                codigo_barras=it.codigo_barras,
                nombre=nombre_limpio,
                categoria=it.categoria or "General",
                stock_actual=cant_u,
                costo_referencial=costo_u,
                pvp=pvp_sug
            )
            db.add(nuevo)
            creados += 1

    db.commit()
    return {"status": "ok", "actualizados": afectados, "creados": creados}

# ---------------------------------------------------------
# REGISTRO Y COBRO DE VENTAS POS
# ---------------------------------------------------------
@app.post("/api/pos/cobrar")
def procesar_venta_pos(payload: VentaCobroIn, db: Session = Depends(get_db)):
    if not payload.items:
        raise HTTPException(status_code=400, detail="El ticket de venta está vacío.")
    
    try:
        hoy_str = datetime.utcnow().strftime("%Y%m%d")
        total_hoy = db.query(VentaPOS).filter(VentaPOS.numero_ticket.like(f"TKT-{hoy_str}-%")).count()
        num_ticket = f"TKT-{hoy_str}-{(total_hoy + 1):04d}"

        nueva_venta = VentaPOS(
            numero_ticket=num_ticket,
            metodo_pago=payload.metodo_pago,
            subtotal=payload.subtotal,
            impuestos=payload.impuestos,
            total=payload.total,
            monto_recibido=payload.monto_recibido,
            cambio=payload.cambio,
            fecha_hora=datetime.utcnow()
        )
        db.add(nueva_venta)
        db.flush()

        for it in payload.items:
            prod = None
            if it.producto_id:
                prod = db.query(ProductoPVP).filter(ProductoPVP.id == it.producto_id).first()
            
            nom_prod = prod.nombre if prod else "Producto POS"

            if prod:
                nuevo_stock = max(0.0, float(prod.stock_actual or 0) - float(it.cantidad))
                prod.stock_actual = nuevo_stock

            linea = DetalleVentaPOS(
                venta_id=nueva_venta.id,
                producto_id=it.producto_id,
                nombre_producto=nom_prod,
                cantidad=it.cantidad,
                precio_unitario=it.precio_unitario,
                total=it.total
            )
            db.add(linea)

        db.commit()
        return {
            "status": "ok",
            "mensaje": "Venta procesada y guardada correctamente",
            "ticket": num_ticket,
            "total": payload.total,
            "cambio": payload.cambio
        }

    except Exception as e:
        db.rollback()
        logger.error(f"Error procesando cobro POS: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Fallo al registrar en base de datos: {str(e)}")

@app.get("/api/pos/ventas-historial")
def listar_historial_ventas(db: Session = Depends(get_db)):
    ventas = (
        db.query(VentaPOS)
        .options(joinedload(VentaPOS.lineas))
        .order_by(desc(VentaPOS.fecha_hora))
        .all()
    )
    resultado = []
    for v in ventas:
        items = [
            {
                "id": det.id,
                "producto_id": det.producto_id,
                "nombre_producto": det.nombre_producto,
                "cantidad": float(det.cantidad or 0),
                "precio_unitario": float(det.precio_unitario or 0),
                "total": float(det.total or 0)
            }
            for det in v.lineas
        ]
        resultado.append({
            "id": v.id,
            "numero_ticket": v.numero_ticket,
            "fecha_hora": v.fecha_hora.isoformat() if v.fecha_hora else None,
            "metodo_pago": v.metodo_pago,
            "subtotal": float(v.subtotal or 0),
            "impuestos": float(v.impuestos or 0),
            "total": float(v.total or 0),
            "monto_recibido": float(v.monto_recibido or 0),
            "cambio": float(v.cambio or 0),
            "items": items
        })
    return resultado

@app.patch("/api/pos/ventas/{id}")
def editar_venta_pos(id: int, payload: VentaEditarIn, db: Session = Depends(get_db)):
    venta = db.query(VentaPOS).filter(VentaPOS.id == id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Ticket de venta no encontrado.")
    
    if payload.metodo_pago:
        venta.metodo_pago = payload.metodo_pago
    if payload.monto_recibido is not None:
        venta.monto_recibido = payload.monto_recibido
    if payload.cambio is not None:
        venta.cambio = payload.cambio
        
    db.commit()
    return {"status": "ok", "mensaje": "Venta actualizada correctamente"}

@app.delete("/api/pos/ventas/{id}")
def anular_venta_pos(id: int, devolver_stock: bool = Query(True), db: Session = Depends(get_db)):
    venta = db.query(VentaPOS).options(joinedload(VentaPOS.lineas)).filter(VentaPOS.id == id).first()
    if not venta:
        raise HTTPException(status_code=404, detail="Ticket no encontrado.")
    
    if devolver_stock:
        prod_ids = [l.producto_id for l in venta.lineas if l.producto_id]
        if prod_ids:
            productos = {p.id: p for p in db.query(ProductoPVP).filter(ProductoPVP.id.in_(prod_ids)).all()}
            for linea in venta.lineas:
                if linea.producto_id in productos:
                    p = productos[linea.producto_id]
                    p.stock_actual = float(p.stock_actual or 0) + float(linea.cantidad or 0)
    
    db.delete(venta)
    db.commit()
    return {"status": "ok", "mensaje": "Ticket anulado exitosamente"}

# ---------------------------------------------------------
# FRONTEND ESTÁTICO (RESOLUCIÓN DE RUTAS SEGURA)
# ---------------------------------------------------------
if getattr(sys, 'frozen', False):
    base_path = sys._MEIPASS
    frontend_dir = os.path.join(base_path, "frontend")
else:
    base_path = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
    frontend_dir = os.path.join(base_path, "frontend")

if os.path.exists(frontend_dir):
    css_dir = os.path.join(frontend_dir, "css")
    js_dir = os.path.join(frontend_dir, "js")
    if os.path.exists(css_dir):
        app.mount("/css", StaticFiles(directory=css_dir), name="css")
    if os.path.exists(js_dir):
        app.mount("/js", StaticFiles(directory=js_dir), name="js")
    
    app.mount("/frontend", StaticFiles(directory=frontend_dir), name="frontend_mount")
    app.mount("/static", StaticFiles(directory=frontend_dir), name="static")

    @app.get("/")
    def index():
        return FileResponse(os.path.join(frontend_dir, "dashboard.html"))

    @app.get("/{full_path:path}")
    def catch_all(full_path: str):
        archivo_path = os.path.join(frontend_dir, full_path)
        if os.path.isfile(archivo_path):
            return FileResponse(archivo_path)
        return FileResponse(os.path.join(frontend_dir, "dashboard.html"))