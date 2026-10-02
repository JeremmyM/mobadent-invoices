from pydantic import BaseModel, Field
from typing import List, Optional
from datetime import date, datetime

# --- Esquemas usados por Gemini (ai_extractor.py) ---

class ItemFacturaAI(BaseModel):
    descripcion: str = Field(default="", description="Descripción del producto o servicio")
    cantidad: float = Field(default=1.0, description="Cantidad adquirida")
    precio_unitario: float = Field(default=0.0, description="Precio unitario")
    precio_total: float = Field(default=0.0, description="Precio total del ítem")
    categoria: Optional[str] = Field(default="General", description="Categoría estimada del insumo")

class FacturaExtraccionAI(BaseModel):
    proveedor_nombre: str = Field(default="Consumidor Final", description="Razón social o nombre del emisor")
    proveedor_id_fiscal: str = Field(default="9999999999999", description="RUC o identificación tributaria del emisor")
    numero_factura: str = Field(default="", description="Número de comprobante secuencial")
    fecha_emision: Optional[str] = Field(default=None, description="Fecha de emisión en formato YYYY-MM-DD")
    numero_autorizacion: Optional[str] = Field(default=None, description="Clave de acceso o autorización")
    
    base_iva_0: float = Field(default=0.0, description="Subtotal tarifa 0%")
    base_iva_grabada: float = Field(default=0.0, description="Subtotal tarifa gravada con IVA")
    subtotal: float = Field(default=0.0, description="Subtotal general sin impuestos")
    impuestos: float = Field(default=0.0, description="Monto total del IVA u otros impuestos")
    total: float = Field(default=0.0, description="Importe total a pagar")
    
    items: List[ItemFacturaAI] = Field(default_factory=list, description="Lista de productos desglosados")


# --- Esquemas de lectura y payload ---

class DetalleFacturaOut(BaseModel):
    id: int
    descripcion: str
    categoria: Optional[str] = "General"
    cantidad: float
    precio_unitario: float
    precio_total: float

    class Config:
        from_attributes = True

class FacturaOut(BaseModel):
    id: int
    proveedor_nombre: str
    proveedor_ruc: str
    numero_factura: str
    fecha_emision: Optional[date] = None
    subtotal: float
    iva: float
    total: float
    estado_pago: Optional[str] = "Pendiente"
    metodo_pago: Optional[str] = None
    fecha_pago: Optional[date] = None
    url_factura: Optional[str] = None
    url_comprobante_pago: Optional[str] = None
    items: List[DetalleFacturaOut] = []

    class Config:
        from_attributes = True