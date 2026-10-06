from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey, UniqueConstraint, Text
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.database import Base

class Proveedor(Base):
    __tablename__ = "proveedores"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, nullable=True, index=True)
    identificacion_fiscal = Column(String, nullable=True, unique=True, index=True)

    facturas = relationship("Factura", back_populates="proveedor")


class Factura(Base):
    __tablename__ = "facturas"

    id = Column(Integer, primary_key=True, index=True)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"), nullable=False)
    numero_factura = Column(String(100), nullable=False, index=True)
    numero_autorizacion = Column(String(100), nullable=True)
    fecha_emision = Column(Date, nullable=True)
    estado_pago = Column(String(50), default="Pendiente")
    metodo_pago = Column(String(50), nullable=True)
    fecha_pago = Column(Date, nullable=True)
    comentario = Column(Text, nullable=True)
    
    # NUEVOS CAMPOS DE AUDITORÍA DISCRETA
    dispositivo_origen = Column(String(150), nullable=True)  # Ej: PC-RECEPCION (jerem)
    created_at = Column(DateTime(timezone=True), server_default=func.now())  # Fecha de carga real
    
    base_iva_0 = Column(Float, default=0.0)
    base_iva_grabada = Column(Float, default=0.0)
    porcentaje_iva = Column(Float, default=15.0)
    descuento_total = Column(Float, default=0.0)
    subtotal = Column(Float, default=0.0)
    impuestos = Column(Float, default=0.0)
    total = Column(Float, default=0.0)
    url_factura = Column(Text, nullable=True)
    url_comprobante_pago = Column(Text, nullable=True)

    proveedor = relationship("Proveedor", back_populates="facturas")
    items = relationship("DetalleFactura", back_populates="factura", cascade="all, delete-orphan")

class DetalleFactura(Base):
    __tablename__ = "detalles_factura"

    id = Column(Integer, primary_key=True, index=True)
    factura_id = Column(Integer, ForeignKey("facturas.id", ondelete="CASCADE"), nullable=False)
    descripcion = Column(String(500), nullable=False)
    categoria = Column(String(100), default="General")
    lote = Column(String(100), default="N/A")
    fecha_caducidad = Column(Date, nullable=True)  # <-- Indispensable
    cantidad = Column(Float, default=1.0)
    precio_unitario = Column(Float, default=0.0)
    porcentaje_descuento = Column(Float, default=0.0)
    precio_total = Column(Float, default=0.0)

    factura = relationship("Factura", back_populates="items")


class CatalogoInsumo(Base):
    __tablename__ = "catalogo_insumos"

    id = Column(Integer, primary_key=True, index=True)
    descripcion_normalizada = Column(String(255), unique=True, index=True, nullable=False)
    categoria = Column(String(100), nullable=False)