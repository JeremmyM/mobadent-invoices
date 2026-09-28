from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, Date, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from .database import Base

class Proveedor(Base):
    __tablename__ = "proveedores"

    id = Column(Integer, primary_key=True, index=True)
    nombre = Column(String, unique=True, index=True)
    identificacion_fiscal = Column(String, nullable=True)

    facturas = relationship("Factura", back_populates="proveedor")

class Factura(Base):
    __tablename__ = "facturas"

    id = Column(Integer, primary_key=True, index=True)
    proveedor_id = Column(Integer, ForeignKey("proveedores.id"))
    numero_factura = Column(String, index=True)
    numero_autorizacion = Column(String, nullable=True)
    fecha_emision = Column(Date, nullable=True)
    fecha_registro = Column(DateTime, default=datetime.utcnow)

    # Control de Tesorería y Auditoría
    estado_pago = Column(String, default="Pendiente")  # "Pendiente" o "Pagado"
    comentario = Column(String, nullable=True)

    base_iva_0 = Column(Float, default=0.0)
    base_iva_grabada = Column(Float, default=0.0)
    porcentaje_iva = Column(Float, default=15.0)
    descuento_total = Column(Float, default=0.0)
    subtotal = Column(Float, default=0.0)
    impuestos = Column(Float, default=0.0)
    total = Column(Float, default=0.0)

    proveedor = relationship("Proveedor", back_populates="facturas")
    lineas = relationship("LineaFactura", back_populates="factura", cascade="all, delete-orphan")

class LineaFactura(Base):
    __tablename__ = "lineas_factura"

    id = Column(Integer, primary_key=True, index=True)
    factura_id = Column(Integer, ForeignKey("facturas.id"))
    sku = Column(String, nullable=True)
    descripcion = Column(String, index=True)
    lote = Column(String, nullable=True)
    cantidad = Column(Float, default=1.0)
    precio_unitario = Column(Float, default=0.0)
    porcentaje_descuento = Column(Float, default=0.0)
    descuento_valor = Column(Float, default=0.0)
    subtotal = Column(Float, default=0.0)

    factura = relationship("Factura", back_populates="lineas")