import { NextResponse } from "next/server";
import { requireInventoryAccess } from "../../../../../lib/v6-inventory-access";

export async function GET(request: Request) {
  const auth = await requireInventoryAccess(request, "view_inventory");
  if (!auth.ok) return NextResponse.json({ ok:false, message:auth.message }, { status:auth.status });
  const hospitalId=auth.access.hospitalId;
  await auth.supabaseAdmin.rpc("pawu_refresh_inventory_alerts", { p_hospital_id:hospitalId });
  const [items,lots,movements,alerts,suppliers]=await Promise.all([
    auth.supabaseAdmin.from("inventory_items").select("*").eq("hospital_id",hospitalId).eq("is_active",true).order("category").order("name"),
    auth.supabaseAdmin.from("inventory_lots").select("id,inventory_item_id,lot_number,expires_on,received_on,remaining_quantity,unit_cost,supplier_name,inventory_items!inner(id,name,unit,hospital_id)").eq("inventory_items.hospital_id",hospitalId).gt("remaining_quantity",0).order("expires_on",{ascending:true,nullsFirst:false}),
    auth.supabaseAdmin.from("inventory_movements").select("id,movement_type,quantity_change,quantity_before,quantity_after,reason,reference_type,reference_id,created_at,inventory_items!inner(id,name,unit,hospital_id)").eq("inventory_items.hospital_id",hospitalId).order("created_at",{ascending:false}).limit(40),
    auth.supabaseAdmin.from("inventory_alerts").select("id,alert_type,severity,message,inventory_item_id,lot_id,resolved_at,created_at,inventory_items(name,unit),inventory_lots(lot_number,expires_on)").eq("hospital_id",hospitalId).is("resolved_at",null).order("severity",{ascending:false}).order("created_at",{ascending:false}),
    auth.supabaseAdmin.from("inventory_suppliers").select("*").eq("hospital_id",hospitalId).eq("is_active",true).order("name"),
  ]);
  const error=items.error||lots.error||movements.error||alerts.error||suppliers.error;
  if(error) return NextResponse.json({ok:false,message:error.message},{status:400});
  const rows=items.data??[];
  const totalValue=rows.reduce((s,x)=>s+Number(x.current_quantity??0)*Number(x.average_unit_cost??0),0);
  const low=rows.filter(x=>Number(x.current_quantity)<=Number(x.minimum_quantity));
  const out=rows.filter(x=>Number(x.current_quantity)<=0);
  return NextResponse.json({ok:true,data:{items:rows,lots:lots.data??[],recentMovements:movements.data??[],alerts:alerts.data??[],suppliers:suppliers.data??[],counts:{activeItems:rows.length,lowStockItems:low.length,outOfStockItems:out.length,openAlerts:alerts.data?.length??0,estimatedInventoryValue:Math.round(totalValue)}}});
}
