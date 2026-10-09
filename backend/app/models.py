from datetime import datetime, date
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, Boolean, Text
from sqlalchemy.orm import relationship
from app.database import Base

class Proveedor(Base):
    __tablename__ = "proveedores"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String(255), unique=True, index=True, nullable=False)
    ruc = Column(String(50), nullable=True)
    direccion = Column(String(255), nullable=True)
    telefono = Column(String(50), nullable=True)
    email = Column(String(100), nullable=True)

    facturas = relationship("Factura", back_populates="proveedor_rel")

class Factura(Base):
    __tablename__ = "facturas"

    id = Column(Integer, primary_key=True, index=True)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"), nullable=True)
    numero_factura = Column(String(100), index=True, nullable=False)
    fecha_emision = Column(Date, nullable=True)
    total = Column(Float, default=0.0)
    subtotal = Column(Float, default=0.0)
    impuestos = Column(Float, default=0.0)
    estado_pago = Column(String(50), default="Pendiente")
    comentario = Column(Text, default="")
    url_factura = Column(Text, default="")
    creado_en = Column(DateTime, default=datetime.utcnow)

    proveedor_rel = relationship("Proveedor", back_populates="facturas")
    detalles = relationship("DetalleFactura", back_populates="factura", cascade="all, delete-orphan")

class ProductoPVP(Base):
    __tablename__ = "productos_pvp"

    id = Column(Integer, primary_key=True, index=True)
    codigo_barras = Column(String(100), unique=True, index=True, nullable=True)
    nombre = Column(String(255), index=True, nullable=False)
    categoria = Column(String(100), default="General")
    stock_actual = Column(Float, default=0.0)
    costo_referencial = Column(Float, default=0.0)
    pvp = Column(Float, default=0.0)
    activo = Column(Boolean, default=True)

    detalles_factura = relationship("DetalleFactura", back_populates="producto_pvp_rel")
    detalles_venta_pos = relationship("DetalleVentaPOS", back_populates="producto_pvp_rel")

class DetalleFactura(Base):
    __tablename__ = "detalles_factura"

    id = Column(Integer, primary_key=True, index=True)
    factura_id = Column(Integer, ForeignKey("facturas.id"), nullable=False)
    producto_pvp_id = Column(Integer, ForeignKey("productos_pvp.id"), nullable=True)
    descripcion = Column(String(255), nullable=False)
    categoria = Column(String(100), default="General")
    lote = Column(String(100), default="N/A")
    cantidad = Column(Float, default=1.0)
    precio_unitario = Column(Float, default=0.0)
    porcentaje_descuento = Column(Float, default=0.0)
    precio_total = Column(Float, default=0.0)
    fecha_caducidad = Column(Date, nullable=True)

    factura = relationship("Factura", back_populates="detalles")
    producto_pvp_rel = relationship("ProductoPVP", back_populates="detalles_factura")

# ---------------------------------------------------------
# REGISTRO HISTÓRICO DE TRANSACCIONES POS
# ---------------------------------------------------------
class VentaPOS(Base):
    __tablename__ = "ventas_pos"

    id = Column(Integer, primary_key=True, index=True)
    numero_ticket = Column(String(50), unique=True, index=True)
    fecha_hora = Column(DateTime, default=datetime.utcnow)
    metodo_pago = Column(String(50), default="Cash")
    subtotal = Column(Float, default=0.0)
    impuestos = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    monto_recibido = Column(Float, default=0.0)
    cambio = Column(Float, default=0.0)

    lineas = relationship("DetalleVentaPOS", back_populates="venta", cascade="all, delete-orphan")

class DetalleVentaPOS(Base):
    __tablename__ = "detalles_ventas_pos"

    id = Column(Integer, primary_key=True, index=True)
    venta_id = Column(Integer, ForeignKey("ventas_pos.id"))
    producto_id = Column(Integer, ForeignKey("productos_pvp.id"), nullable=True)
    nombre_producto = Column(String(255))
    cantidad = Column(Float, default=1.0)
    precio_unitario = Column(Float, default=0.0)
    total = Column(Float, default=0.0)

    venta = relationship("VentaPOS", back_populates="lineas")
    producto_pvp_rel = relationship("ProductoPVP", back_populates="detalles_venta_pos")