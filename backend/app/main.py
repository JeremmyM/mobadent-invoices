import os
from datetime import datetime, timedelta
from typing import List, Optional
from collections import defaultdict

from fastapi import FastAPI, UploadFile, File, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from pydantic import BaseModel

from .database import engine, Base, get_db
from . import models
from .schemas import FacturaExtraccionAI
from .ai_extractor import procesar_documento_factura

# Crear tablas si no existen
Base.metadata.create_all(bind=engine)

app = FastAPI(title="Mobadent Invoices API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- ESQUEMAS DE VALIDACIÓN Y EDICIÓN ---
class LineaUpdateSchema(BaseModel):
    descripcion: str
    lote: Optional[str] = None
    cantidad: float
    precio_unitario: float
    porcentaje_descuento: float = 0.0

class FacturaUpdateSchema(BaseModel):
    numero_factura: str
    fecha_emision: Optional[str] = None
    items: List[LineaUpdateSchema]

class EstadoPagoSchema(BaseModel):
    estado_pago: str  # "Pagado" o "Pendiente"
    comentario: Optional[str] = None

class FacturaGuardarPayload(FacturaExtraccionAI):
    estado_pago: Optional[str] = "Pendiente"
    comentario: Optional[str] = ""


# --- ENDPOINTS DE FACTURACIÓN ---

@app.post("/api/facturas/analizar", response_model=FacturaExtraccionAI)
async def analizar_factura(file: UploadFile = File(...)):
    content = await file.read()
    datos = await procesar_documento_factura(content, file.content_type)
    return datos


@app.post("/api/facturas/guardar")
def guardar_factura(factura_data: FacturaGuardarPayload, db: Session = Depends(get_db)):
    proveedor = db.query(models.Proveedor).filter(
        models.Proveedor.nombre == factura_data.proveedor_nombre.strip()
    ).first()

    if not proveedor:
        proveedor = models.Proveedor(
            nombre=factura_data.proveedor_nombre.strip(),
            identificacion_fiscal=factura_data.proveedor_id_fiscal
        )
        db.add(proveedor)
        db.commit()
        db.refresh(proveedor)

    fecha_emision = None
    if factura_data.fecha_emision:
        try:
            fecha_emision = datetime.strptime(factura_data.fecha_emision, "%Y-%m-%d").date()
        except ValueError:
            pass

    nueva_factura = models.Factura(
        proveedor_id=proveedor.id,
        numero_factura=factura_data.numero_factura.strip(),
        numero_autorizacion=factura_data.numero_autorizacion,
        fecha_emision=fecha_emision,
        estado_pago=factura_data.estado_pago or "Pendiente",
        comentario=factura_data.comentario or "",
        base_iva_0=factura_data.base_iva_0,
        base_iva_grabada=factura_data.base_iva_grabada,
        porcentaje_iva=factura_data.porcentaje_iva,
        descuento_total=factura_data.descuento_total,
        subtotal=factura_data.subtotal,
        impuestos=factura_data.impuestos,
        total=factura_data.total
    )
    db.add(nueva_factura)
    db.commit()
    db.refresh(nueva_factura)

    for item in factura_data.items:
        linea = models.LineaFactura(
            factura_id=nueva_factura.id,
            sku=item.sku,
            descripcion=item.descripcion.strip(),
            lote=item.lote,
            cantidad=item.cantidad,
            precio_unitario=item.precio_unitario,
            porcentaje_descuento=item.porcentaje_descuento,
            descuento_valor=item.descuento_valor,
            subtotal=item.subtotal
        )
        db.add(linea)

    db.commit()
    return {"status": "ok", "factura_id": nueva_factura.id}


@app.get("/api/facturas/listado")
def listar_facturas(db: Session = Depends(get_db)):
    facturas = db.query(models.Factura).order_by(models.Factura.fecha_registro.desc()).all()
    resultado = []
    for f in facturas:
        resultado.append({
            "id": f.id,
            "proveedor": f.proveedor.nombre if f.proveedor else "Desconocido",
            "numero_factura": f.numero_factura,
            "numero_autorizacion": f.numero_autorizacion,
            "fecha_emision": str(f.fecha_emision) if f.fecha_emision else "S/F",
            "estado_pago": f.estado_pago or "Pendiente",
            "comentario": f.comentario or "",
            "subtotal": f.subtotal,
            "descuento_total": f.descuento_total,
            "base_iva_0": f.base_iva_0,
            "base_iva_grabada": f.base_iva_grabada,
            "porcentaje_iva": f.porcentaje_iva,
            "impuestos": f.impuestos,
            "total": f.total,
            "items_count": len(f.lineas),
            "items": [
                {
                    "sku": l.sku,
                    "descripcion": l.descripcion,
                    "lote": l.lote,
                    "cantidad": l.cantidad,
                    "precio_unitario": l.precio_unitario,
                    "porcentaje_descuento": l.porcentaje_descuento,
                    "descuento_valor": l.descuento_valor,
                    "subtotal": l.subtotal
                }
                for l in f.lineas
            ]
        })
    return resultado


@app.patch("/api/facturas/{factura_id}/estado-pago")
def actualizar_estado_pago(factura_id: int, data: EstadoPagoSchema, db: Session = Depends(get_db)):
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    if data.estado_pago:
        factura.estado_pago = data.estado_pago
    if data.comentario is not None:
        factura.comentario = data.comentario.strip()

    db.commit()
    return {
        "status": "ok",
        "estado_pago": factura.estado_pago,
        "comentario": factura.comentario
    }


@app.put("/api/facturas/{factura_id}")
def actualizar_factura(factura_id: int, data: FacturaUpdateSchema, db: Session = Depends(get_db)):
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")

    factura.numero_factura = data.numero_factura.strip()
    if data.fecha_emision:
        try:
            factura.fecha_emision = datetime.strptime(data.fecha_emision, "%Y-%m-%d").date()
        except ValueError:
            pass

    db.query(models.LineaFactura).filter(models.LineaFactura.factura_id == factura_id).delete()

    subtotal_calculado = 0.0
    for it in data.items:
        st = round(it.cantidad * it.precio_unitario * (1.0 - (it.porcentaje_descuento / 100.0)), 2)
        subtotal_calculado += st
        nueva_linea = models.LineaFactura(
            factura_id=factura_id,
            descripcion=it.descripcion.strip(),
            lote=it.lote.strip() if it.lote else None,
            cantidad=it.cantidad,
            precio_unitario=it.precio_unitario,
            porcentaje_descuento=it.porcentaje_descuento,
            subtotal=st
        )
        db.add(nueva_linea)

    factura.subtotal = round(subtotal_calculado, 2)
    tasa_iva = (factura.porcentaje_iva or 15.0) / 100.0
    factura.impuestos = round(factura.subtotal * tasa_iva, 2)
    factura.total = round(factura.subtotal + factura.impuestos, 2)

    db.commit()
    return {"status": "ok", "message": "Factura actualizada correctamente"}


@app.delete("/api/facturas/{factura_id}")
def eliminar_factura(factura_id: int, db: Session = Depends(get_db)):
    factura = db.query(models.Factura).filter(models.Factura.id == factura_id).first()
    if not factura:
        raise HTTPException(status_code=404, detail="Factura no encontrada")
    db.delete(factura)
    db.commit()
    return {"status": "ok", "message": "Factura eliminada"}


# --- ANALÍTICA & BI ---

@app.get("/api/estadisticas")
def obtener_estadisticas(db: Session = Depends(get_db)):
    facturas = db.query(models.Factura).all()
    total_comprado = sum(f.total for f in facturas)
    cantidad_facturas = len(facturas)

    gastos_proveedor = defaultdict(float)
    for f in facturas:
        nombre = f.proveedor.nombre if f.proveedor else "Desconocido"
        gastos_proveedor[nombre] += f.total

    top_proveedores = sorted(
        [{"proveedor": k, "total": v} for k, v in gastos_proveedor.items()],
        key=lambda x: x["total"],
        reverse=True
    )

    return {
        "total_comprado": round(total_comprado, 2),
        "cantidad_facturas": cantidad_facturas,
        "top_proveedores": top_proveedores
    }


@app.get("/api/analitica/productos")
def analitica_productos(db: Session = Depends(get_db)):
    lineas = db.query(models.LineaFactura).all()
    agrupado = defaultdict(lambda: {"unidades": 0.0, "gasto_total": 0.0})
    for l in lineas:
        nombre = l.descripcion.strip().upper()
        agrupado[nombre]["unidades"] += l.cantidad
        agrupado[nombre]["gasto_total"] += l.subtotal

    resultado = [
        {"producto": k, "unidades": round(v["unidades"], 1), "gasto_total": round(v["gasto_total"], 2)}
        for k, v in agrupado.items()
    ]
    resultado.sort(key=lambda x: x["gasto_total"], reverse=True)
    return resultado[:10]


@app.get("/api/analitica/flujo-caja")
def analitica_flujo_caja(db: Session = Depends(get_db)):
    facturas = db.query(models.Factura).order_by(models.Factura.fecha_emision.asc()).all()
    flujo_dict = defaultdict(lambda: {"monto": 0.0, "cantidad_facturas": 0})

    for f in facturas:
        if f.fecha_emision:
            periodo = f.fecha_emision.strftime("%Y-%m")
        elif f.fecha_registro:
            periodo = f.fecha_registro.strftime("%Y-%m")
        else:
            periodo = "S/F"

        flujo_dict[periodo]["monto"] += f.total
        flujo_dict[periodo]["cantidad_facturas"] += 1

    periodos_ordenados = sorted([p for p in flujo_dict.keys() if p != "S/F"])
    
    resultado = []
    total_desembolsado = 0.0
    for p in periodos_ordenados:
        m = round(flujo_dict[p]["monto"], 2)
        cnt = flujo_dict[p]["cantidad_facturas"]
        total_desembolsado += m
        resultado.append({
            "periodo": p,
            "monto": m,
            "cantidad_facturas": cnt
        })

    if "S/F" in flujo_dict:
        m = round(flujo_dict["S/F"]["monto"], 2)
        resultado.append({
            "periodo": "Sin Fecha",
            "monto": m,
            "cantidad_facturas": flujo_dict["S/F"]["cantidad_facturas"]
        })

    promedio_mensual = round(total_desembolsado / len(periodos_ordenados), 2) if periodos_ordenados else 0.0

    return {
        "historico": resultado,
        "promedio_mensual": promedio_mensual
    }


@app.get("/api/analitica/alertas-precios")
def auditoria_variaciones_precios(dias_limite: int = 45, db: Session = Depends(get_db)):
    fecha_corte = datetime.utcnow() - timedelta(days=dias_limite)

    filas = (
        db.query(models.LineaFactura, models.Factura, models.Proveedor)
        .join(models.Factura, models.LineaFactura.factura_id == models.Factura.id)
        .join(models.Proveedor, models.Factura.proveedor_id == models.Proveedor.id)
        .order_by(
            models.Factura.fecha_emision.desc(),
            models.Factura.fecha_registro.desc(),
            models.Factura.id.desc(),
            models.LineaFactura.id.desc()
        )
        .all()
    )

    productos_historial = defaultdict(list)
    for linea, factura, prov in filas:
        nombre_normalizado = linea.descripcion.strip().upper()
        productos_historial[nombre_normalizado].append({
            "linea_id": linea.id,
            "producto_original": linea.descripcion.strip(),
            "precio_unitario": linea.precio_unitario,
            "proveedor": prov.nombre,
            "fecha": str(factura.fecha_emision) if factura.fecha_emision else str(factura.fecha_registro.date()),
            "fecha_dt": factura.fecha_registro or datetime.utcnow(),
            "factura_id": factura.id
        })

    variaciones = []
    for prod_key, compras in productos_historial.items():
        if len(compras) >= 2:
            compra_actual = compras[0]
            compra_anterior = compras[1]

            if compra_actual["fecha_dt"] < fecha_corte:
                continue

            precio_act = compra_actual["precio_unitario"]
            precio_ant = compra_anterior["precio_unitario"]
            diferencia_dinero = round(precio_act - precio_ant, 2)

            if abs(precio_act - precio_ant) >= 0.005:
                tipo = "INCREMENTO" if diferencia_dinero > 0 else "AHORRO"
                porcentaje = round((abs(diferencia_dinero) / precio_ant) * 100, 1) if precio_ant > 0 else 100.0

                variaciones.append({
                    "id_alerta": f"{compra_actual['factura_id']}_{compra_actual['linea_id']}",
                    "tipo": tipo,
                    "producto": compra_actual["producto_original"],
                    "proveedor": compra_actual["proveedor"],
                    "proveedor_anterior": compra_anterior["proveedor"],
                    "precio_anterior": precio_ant,
                    "precio_actual": precio_act,
                    "diferencia_dinero": abs(diferencia_dinero),
                    "porcentaje": porcentaje,
                    "fecha_actual": compra_actual["fecha"]
                })

    variaciones.sort(key=lambda x: (x["tipo"] == "INCREMENTO", x["diferencia_dinero"]), reverse=True)
    return variaciones


@app.get("/api/productos/buscar")
def buscar_historial_producto(q: str, db: Session = Depends(get_db)):
    if not q or len(q.strip()) < 2:
        return {"total_coincidencias": 0, "productos_agrupados": []}

    termino = f"%{q.strip()}%"
    resultados = (
        db.query(models.LineaFactura, models.Factura, models.Proveedor)
        .join(models.Factura, models.LineaFactura.factura_id == models.Factura.id)
        .join(models.Proveedor, models.Factura.proveedor_id == models.Proveedor.id)
        .filter(models.LineaFactura.descripcion.ilike(termino))
        .order_by(models.Factura.fecha_emision.desc(), models.Factura.fecha_registro.desc())
        .all()
    )

    if not resultados:
        return {"total_coincidencias": 0, "productos_agrupados": []}

    grupos = defaultdict(lambda: {"compras": [], "proveedores": set()})

    for linea, fac, prov in resultados:
        clave = linea.descripcion.strip()
        grupos[clave]["compras"].append({
            "factura_id": fac.id,
            "numero_factura": fac.numero_factura,
            "fecha": str(fac.fecha_emision) if fac.fecha_emision else "S/F",
            "proveedor": prov.nombre,
            "lote": linea.lote or "N/A",
            "cantidad": linea.cantidad,
            "precio_unitario": linea.precio_unitario,
            "porcentaje_descuento": linea.porcentaje_descuento,
            "subtotal": linea.subtotal
        })
        grupos[clave]["proveedores"].add(prov.nombre)

    productos_analizados = []
    for nombre_prod, data in grupos.items():
        compras = data["compras"]
        precios = [c["precio_unitario"] for c in compras]
        cantidades = [c["cantidad"] for c in compras]
        mejor_compra = min(compras, key=lambda x: x["precio_unitario"])

        productos_analizados.append({
            "producto": nombre_prod,
            "veces_comprado": len(compras),
            "unidades_totales": sum(cantidades),
            "ultimo_precio": compras[0]["precio_unitario"],
            "precio_min": min(precios),
            "precio_max": max(precios),
            "precio_promedio": round(sum(precios) / len(precios), 2),
            "mejor_proveedor": mejor_compra["proveedor"],
            "proveedores": list(data["proveedores"]),
            "historial": compras
        })

    productos_analizados.sort(key=lambda x: x["veces_comprado"], reverse=True)
    return {"total_coincidencias": len(productos_analizados), "productos_agrupados": productos_analizados}


@app.get("/api/productos/catalogo-maestro")
def obtener_catalogo_maestro(db: Session = Depends(get_db)):
    lineas = (
        db.query(models.LineaFactura, models.Factura, models.Proveedor)
        .join(models.Factura, models.LineaFactura.factura_id == models.Factura.id)
        .join(models.Proveedor, models.Factura.proveedor_id == models.Proveedor.id)
        .order_by(
            models.Factura.fecha_emision.desc(),
            models.Factura.fecha_registro.desc(),
            models.Factura.id.desc(),
            models.LineaFactura.id.desc()
        )
        .all()
    )

    if not lineas:
        return []

    grupos = defaultdict(lambda: {"compras": [], "proveedores": set()})

    for l, fac, prov in lineas:
        nombre = l.descripcion.strip()
        grupos[nombre]["compras"].append({
            "factura_id": fac.id,
            "numero_factura": fac.numero_factura,
            "fecha": str(fac.fecha_emision) if fac.fecha_emision else str(fac.fecha_registro.date()),
            "proveedor": prov.nombre,
            "lote": l.lote or "N/A",
            "cantidad": l.cantidad,
            "precio_unitario": l.precio_unitario,
            "porcentaje_descuento": l.porcentaje_descuento,
            "subtotal": l.subtotal
        })
        grupos[nombre]["proveedores"].add(prov.nombre)

    catalogo = []
    for nombre_prod, data in grupos.items():
        compras = data["compras"]
        precios = [c["precio_unitario"] for c in compras]
        cantidades = [c["cantidad"] for c in compras]
        
        p_min = min(precios)
        p_max = max(precios)
        p_prom = round(sum(precios) / len(precios), 2)
        
        compra_actual = compras[0]
        ultimo_p = compra_actual["precio_unitario"]

        tipo_variacion = "ESTABLE"
        variacion_pct = 0.0

        if len(compras) >= 2:
            compra_previa = compras[1]
            precio_anterior = compra_previa["precio_unitario"]
            diferencia = round(ultimo_p - precio_anterior, 2)

            if abs(diferencia) >= 0.005 and precio_anterior > 0:
                variacion_pct = round(((ultimo_p - precio_anterior) / precio_anterior) * 100, 1)
                if variacion_pct > 0:
                    tipo_variacion = "SUBIDA"
                elif variacion_pct < 0:
                    tipo_variacion = "AHORRO"

        compra_barata = min(compras, key=lambda x: x["precio_unitario"])
        compra_cara = max(compras, key=lambda x: x["precio_unitario"])

        catalogo.append({
            "producto": nombre_prod,
            "total_compras": len(compras),
            "unidades_totales": sum(cantidades),
            "ultimo_precio": ultimo_p,
            "precio_min": p_min,
            "precio_max": p_max,
            "precio_promedio": p_prom,
            "variacion_pct": abs(variacion_pct),
            "tipo_variacion": tipo_variacion,
            "mejor_proveedor": compra_barata["proveedor"],
            "proveedor_caro": compra_cara["proveedor"],
            "proveedores": list(data["proveedores"]),
            "historial": compras
        })

    catalogo.sort(key=lambda x: x["producto"].upper())
    return catalogo

import os
from fastapi.staticfiles import StaticFiles

frontend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend"))
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")