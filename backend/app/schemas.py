from pydantic import BaseModel, Field
from typing import List, Optional

class ItemFacturaAI(BaseModel):
    sku: Optional[str] = Field(None, description="Código principal o auxiliar del ítem dental")
    descripcion: str = Field(..., description="Descripción detallada del producto dental o servicio")
    lote: Optional[str] = Field(None, description="Número de lote si aparece en la factura")
    cantidad: float = Field(..., description="Cantidad facturada")
    precio_unitario: float = Field(..., description="Precio unitario de lista antes de descuento")
    porcentaje_descuento: float = Field(0.0, description="Porcentaje de descuento aplicado a la línea (ej. 15.0 o 20.0)")
    descuento_valor: float = Field(0.0, description="Monto en valor monetario del descuento de la línea")
    subtotal: float = Field(..., description="Subtotal neto de la línea después de descuentos")

class FacturaExtraccionAI(BaseModel):
    proveedor_nombre: str = Field(..., description="Razón social del proveedor (ej. DISTRIDENTAL S.A.)")
    proveedor_id_fiscal: Optional[str] = Field(None, description="RUC, CIF o NIT del emisor")
    numero_factura: str = Field(..., description="Número completo de factura (ej. 001-011-000005833)")
    numero_autorizacion: Optional[str] = Field(None, description="Número de autorización del SRI o entidad tributaria")
    fecha_emision: Optional[str] = Field(None, description="Fecha de emisión en formato YYYY-MM-DD")
    
    # Desglose impositivo y de descuentos
    base_iva_0: float = Field(0.0, description="Base imponible con tarifa 0% de IVA")
    base_iva_grabada: float = Field(0.0, description="Base imponible con tarifa de IVA (12%, 15%, etc.)")
    porcentaje_iva: float = Field(15.0, description="Porcentaje de IVA aplicado (ej. 15.0 o 12.0)")
    descuento_total: float = Field(0.0, description="Suma total de descuentos de la factura")
    subtotal: float = Field(0.0, description="Subtotal general antes de impuestos")
    impuestos: float = Field(0.0, description="Valor monetario del IVA liquidado")
    total: float = Field(..., description="Importe total neto a pagar")
    
    items: List[ItemFacturaAI] = Field(default_factory=list, description="Desglose de productos o insumos")