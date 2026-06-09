import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Users, Package, ArrowLeft, MapPin } from "lucide-react";
import { toast } from "sonner";
import { AddressAutocomplete } from "@/components/jobs/AddressAutocomplete";
import type { Staff, StaffInsert, StaffUpdate, Product, ProductInsert, ProductUpdate, BaseLocation, BaseLocationInsert, BaseLocationUpdate } from "@/api/types";
import {
  useListStaffQuery, useCreateStaffMutation, useUpdateStaffMutation, useDeleteStaffMutation, useCreateStaffAuthMutation,
} from "@/api/staffApi";
import {
  useListProductsQuery, useCreateProductMutation, useUpdateProductMutation, useDeleteProductMutation,
} from "@/api/productsApi";
import {
  useListBaseLocationsQuery, useCreateBaseLocationMutation, useUpdateBaseLocationMutation, useDeleteBaseLocationMutation,
} from "@/api/locationsApi";

export function SettingsPage() {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/"><ArrowLeft className="h-4 w-4 mr-1" /> Back</Link>
          </Button>
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
            <p className="text-xs text-muted-foreground">Manage staff and products</p>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">
        <Tabs defaultValue="staff" className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="staff"><Users className="h-4 w-4 mr-2" /> Staff</TabsTrigger>
            <TabsTrigger value="products"><Package className="h-4 w-4 mr-2" /> Products</TabsTrigger>
            <TabsTrigger value="bases"><MapPin className="h-4 w-4 mr-2" /> Base Locations</TabsTrigger>
          </TabsList>
          <TabsContent value="staff"><StaffPanel /></TabsContent>
          <TabsContent value="products"><ProductsPanel /></TabsContent>
          <TabsContent value="bases"><BaseLocationsPanel /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

/* ---- Staff ---- */
function StaffPanel() {
  const { data: items = [], isLoading } = useListStaffQuery();
  const [deleteStaff] = useDeleteStaffMutation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Staff | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Remove this staff member? Their job assignments will be removed too.")) return;
    try {
      await deleteStaff(id).unwrap();
      toast.success("Staff removed");
    } catch { toast.error("Failed to delete"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} staff member{items.length === 1 ? "" : "s"}</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add staff
        </Button>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No staff yet. Click <strong>Add staff</strong> to create your first team member.
        </Card>
      ) : (
        <div className="grid gap-2">
          {items.map((s) => (
            <Card key={s.id} className="p-3 flex items-start justify-between gap-3 hover:shadow-sm transition-shadow">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{s.name}</span>
                  <Badge variant="outline" className={s.role === "admin" ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground"}>{s.role}</Badge>
                  {!s.active && <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30">Inactive</Badge>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{s.email || "—"}{s.phone ? ` · ${s.phone}` : ""}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(s); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(s.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <StaffDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} staff={editing} />
    </div>
  );
}

function StaffDialog({ open, onOpenChange, staff }: { open: boolean; onOpenChange: (v: boolean) => void; staff: Staff | null }) {
  const empty = useMemo<StaffInsert>(() => ({ name: "", email: null, phone: null, role: "user", active: true }), []);
  const [form, setForm] = useState<StaffInsert>(empty);
  const [password, setPassword] = useState("");
  const [createStaff] = useCreateStaffMutation();
  const [updateStaff] = useUpdateStaffMutation();
  const [createAuth] = useCreateStaffAuthMutation();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(staff ? { name: staff.name, email: staff.email, phone: staff.phone, role: staff.role, active: staff.active } : empty);
      setPassword("");
    }
  }, [open, staff, empty]);

  async function handleSave() {
    if (!form.name?.trim()) { toast.error("Name is required"); return; }
    const emailTrimmed = (form.email ?? "").trim();
    if (password) {
      if (!emailTrimmed) { toast.error("Email is required to set a password"); return; }
      if (password.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    }
    try {
      setSaving(true);
      const body: StaffUpdate = { name: form.name, email: form.email, phone: form.phone, role: form.role, active: form.active };
      if (staff) {
        await updateStaff({ id: staff.id, body }).unwrap();
        toast.success("Staff updated");
      } else {
        await createStaff(form).unwrap();
        toast.success("Staff added");
      }
      if (password && emailTrimmed) {
        const r = await createAuth({ email: emailTrimmed, password }).unwrap();
        if (r.skipped && r.message) toast.warning(r.message);
      }
      onOpenChange(false);
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{staff ? "Edit staff" : "Add staff"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Email</Label>
              <Input type="email" value={form.email ?? ""} onChange={(e) => setForm({ ...form, email: e.target.value || null })} />
            </div>
            <div className="grid gap-1.5">
              <Label>Phone</Label>
              <Input value={form.phone ?? ""} onChange={(e) => setForm({ ...form, phone: e.target.value || null })} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Password {staff ? "(leave blank to keep)" : "(optional, min 8 chars)"}</Label>
            <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" placeholder={staff ? "Set new password to reset" : "Set login password"} />
            <p className="text-[11px] text-muted-foreground">Login uses staff email. Setting a password creates or updates their login.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select value={form.role ?? "user"} onValueChange={(v) => setForm({ ...form, role: v as "admin" | "user" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="user">User</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Status</Label>
              <Select value={form.active ? "active" : "inactive"} onValueChange={(v) => setForm({ ...form, active: v === "active" })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="inactive">Inactive</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">Only staff with the <strong>User</strong> role appear in the job assignment dropdown.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Products ---- */
function ProductsPanel() {
  const { data: items = [], isLoading } = useListProductsQuery();
  const [deleteProduct] = useDeleteProductMutation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Remove this product?")) return;
    try {
      await deleteProduct(id).unwrap();
      toast.success("Product removed");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to delete";
      toast.error(msg.includes("foreign") ? "Can't delete: this product is used on a job" : msg);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} product{items.length === 1 ? "" : "s"}</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add product
        </Button>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No products yet. Click <strong>Add product</strong> to create your first one.
        </Card>
      ) : (
        <div className="grid gap-2">
          {items.map((p) => (
            <Card key={p.id} className="p-3 flex items-start justify-between gap-3 hover:shadow-sm transition-shadow">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-medium truncate">{p.name}</span>
                  {p.sku && <Badge variant="outline" className="font-mono text-[10px]">{p.sku}</Badge>}
                  <Badge variant="secondary">${Number(p.price).toFixed(2)}</Badge>
                  {!p.active && <Badge variant="outline" className="bg-amber-500/15 text-amber-700 border-amber-500/30">Inactive</Badge>}
                </div>
                {p.description && <div className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{p.description}</div>}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(p.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ProductDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} product={editing} />
    </div>
  );
}

function ProductDialog({ open, onOpenChange, product }: { open: boolean; onOpenChange: (v: boolean) => void; product: Product | null }) {
  const empty = useMemo<ProductInsert>(() => ({ name: "", sku: null, price: 0, description: null, active: true }), []);
  const [form, setForm] = useState<ProductInsert>(empty);
  const [createProduct] = useCreateProductMutation();
  const [updateProduct] = useUpdateProductMutation();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(product ? { name: product.name, sku: product.sku, price: product.price, description: product.description, active: product.active } : empty);
    }
  }, [open, product, empty]);

  async function handleSave() {
    if (!form.name?.trim()) { toast.error("Name is required"); return; }
    try {
      setSaving(true);
      const body: ProductUpdate = { name: form.name, sku: form.sku || null, price: form.price, description: form.description || null, active: form.active };
      if (product) {
        await updateProduct({ id: product.id, body }).unwrap();
        toast.success("Product updated");
      } else {
        await createProduct(form).unwrap();
        toast.success("Product added");
      }
      onOpenChange(false);
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{product ? "Edit product" : "Add product"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>SKU</Label>
              <Input value={form.sku ?? ""} onChange={(e) => setForm({ ...form, sku: e.target.value || null })} placeholder="e.g. WID-001" />
            </div>
            <div className="grid gap-1.5">
              <Label>Price ($)</Label>
              <Input type="number" min={0} step="0.01" value={form.price ?? 0} onChange={(e) => setForm({ ...form, price: parseFloat(e.target.value) || 0 })} />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Description</Label>
            <Textarea rows={3} value={form.description ?? ""} onChange={(e) => setForm({ ...form, description: e.target.value || null })} />
          </div>
          <div className="grid gap-1.5">
            <Label>Status</Label>
            <Select value={form.active ? "active" : "inactive"} onValueChange={(v) => setForm({ ...form, active: v === "active" })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---- Base Locations ---- */
function BaseLocationsPanel() {
  const { data: items = [], isLoading } = useListBaseLocationsQuery();
  const [deleteBase] = useDeleteBaseLocationMutation();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<BaseLocation | null>(null);

  async function handleDelete(id: string) {
    if (!confirm("Remove this base location?")) return;
    try {
      await deleteBase(id).unwrap();
      toast.success("Base location removed");
    } catch { toast.error("Failed to delete"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{items.length} base location{items.length === 1 ? "" : "s"}</p>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Add base location
        </Button>
      </div>
      {isLoading ? (
        <div className="text-sm text-muted-foreground py-12 text-center">Loading…</div>
      ) : items.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          <MapPin className="h-8 w-8 mx-auto mb-2 opacity-50" />
          No base locations yet. Click <strong>Add base location</strong> to add one.
          <p className="text-xs mt-2">Base locations are used as the starting point for the Daily Planner route optimization.</p>
        </Card>
      ) : (
        <div className="grid gap-2">
          {items.map((b) => (
            <Card key={b.id} className="p-3 flex items-start justify-between gap-3 hover:shadow-sm transition-shadow">
              <div className="min-w-0 flex-1">
                <div className="font-medium truncate">{b.name}</div>
                <div className="text-xs text-muted-foreground truncate flex items-center gap-1">
                  <MapPin className="h-3 w-3 shrink-0" />{b.address}
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button size="icon" variant="ghost" onClick={() => { setEditing(b); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => handleDelete(b.id)}><Trash2 className="h-4 w-4" /></Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <BaseLocationDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }} base={editing} />
    </div>
  );
}

function BaseLocationDialog({ open, onOpenChange, base }: { open: boolean; onOpenChange: (v: boolean) => void; base: BaseLocation | null }) {
  const empty = useMemo<BaseLocationInsert>(() => ({ name: "", address: "", lat: 0, lng: 0 }), []);
  const [form, setForm] = useState<BaseLocationInsert>(empty);
  const [createBase] = useCreateBaseLocationMutation();
  const [updateBase] = useUpdateBaseLocationMutation();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(base ? { name: base.name, address: base.address, lat: base.lat, lng: base.lng } : empty);
    }
  }, [open, base, empty]);

  async function handleSave() {
    if (!form.name?.trim()) { toast.error("Name is required"); return; }
    if (!form.address?.trim() || !form.lat || !form.lng) { toast.error("Pick an address from the suggestions"); return; }
    try {
      setSaving(true);
      const body: BaseLocationUpdate = { name: form.name, address: form.address, lat: form.lat, lng: form.lng };
      if (base) {
        await updateBase({ id: base.id, body }).unwrap();
        toast.success("Base location updated");
      } else {
        await createBase(form).unwrap();
        toast.success("Base location added");
      }
      onOpenChange(false);
    } catch { toast.error("Failed to save"); }
    finally { setSaving(false); }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle>{base ? "Edit base location" : "Add base location"}</DialogTitle></DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Main Warehouse" />
          </div>
          <div className="grid gap-1.5">
            <Label>Address</Label>
            <AddressAutocomplete
              value={form.address}
              onChange={(v) => setForm({ ...form, address: v })}
              onSelect={({ address, lat, lng }) => setForm({ ...form, address, lat, lng })}
              placeholder="Search for an address…"
            />
            {form.lat && form.lng && <p className="text-[11px] text-muted-foreground">{form.lat.toFixed(5)}, {form.lng.toFixed(5)}</p>}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={handleSave} disabled={saving}>{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
