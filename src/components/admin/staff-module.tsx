"use client";

/** Staff enrollment, lifecycle management and the role/permission matrix. */

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  BadgeCheck,
  Copy,
  KeyRound,
  Lock,
  PauseCircle,
  PlayCircle,
  ShieldCheck,
  UserMinus,
  UserPlus,
  Users,
} from "lucide-react";
import { formatDate } from "@/components/admin/admin-utils";
import { PERMISSIONS, PERMISSION_LABELS, type Permission } from "@/lib/permissions";
import type { RoleDTO } from "@/lib/types";
import { useAdminApi } from "@/components/admin/admin-context";
import {
  ConfirmDialog,
  EmptyState,
  SkeletonRows,
  StaffStatusBadge,
} from "@/components/admin/admin-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MoreHorizontal } from "lucide-react";

interface StaffRow {
  id: string;
  email: string;
  name: string;
  roleId: string;
  roleName: string;
  status: string;
  department: string | null;
  hasPassword: boolean;
  createdAt: string;
  lastLoginAt: string | null;
}

interface StaffResponse {
  staff: StaffRow[];
  roles: RoleDTO[];
}

export function StaffModule() {
  const { get } = useAdminApi();
  const [data, setData] = useState<StaffResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const res = await get<StaffResponse>("/api/admin/staff");
    if (res) setData(res);
    setLoading(false);
  }, [get]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await get<StaffResponse>("/api/admin/staff");
      if (!cancelled) {
        if (res) setData(res);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [get]);

  return (
    <Tabs defaultValue="staff" className="space-y-4">
      <TabsList>
        <TabsTrigger value="staff" className="gap-2"><Users className="h-4 w-4" /> Staff</TabsTrigger>
        <TabsTrigger value="roles" className="gap-2"><ShieldCheck className="h-4 w-4" /> Roles & permissions</TabsTrigger>
      </TabsList>
      <TabsContent value="staff">
        <StaffTab data={data} loading={loading} onChanged={load} />
      </TabsContent>
      <TabsContent value="roles">
        <RolesTab roles={data?.roles ?? null} loading={loading} onChanged={load} />
      </TabsContent>
    </Tabs>
  );
}

// ---------------- Staff list ----------------

function StaffTab({ data, loading, onChanged }: { data: StaffResponse | null; loading: boolean; onChanged: () => Promise<void> }) {
  const { send } = useAdminApi();
  const [inviteOpen, setInviteOpen] = useState(false);
  const [suspending, setSuspending] = useState<StaffRow | null>(null);
  const [deactivating, setDeactivating] = useState<StaffRow | null>(null);
  const [editing, setEditing] = useState<StaffRow | null>(null);
  const [passwordFor, setPasswordFor] = useState<StaffRow | null>(null);
  const [working, setWorking] = useState(false);

  async function action(target: StaffRow, act: "activate" | "suspend" | "deactivate") {
    setWorking(true);
    const res = await send<{ success: boolean }>("/api/admin/staff", "PATCH", { id: target.id, action: act });
    setWorking(false);
    if (res !== null) {
      toast.success(
        act === "activate" ? `${target.name} activated.` : act === "suspend" ? `${target.name} suspended.` : `${target.name} set to pending.`
      );
      setSuspending(null);
      setDeactivating(null);
      await onChanged();
    }
  }

  const staff = data?.staff ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{staff.length} team member{staff.length === 1 ? "" : "s"} · invitations and access changes are audited.</p>
        <Button onClick={() => setInviteOpen(true)} className="bg-forest text-cream hover:bg-[#23503E]">
          <UserPlus className="h-4 w-4" /> Invite staff
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {loading && !data ? (
          <div className="p-4"><SkeletonRows rows={5} /></div>
        ) : staff.length === 0 ? (
          <div className="p-4"><EmptyState icon={Users} title="No staff yet" body="Invite your first team member to get started." /></div>
        ) : (
          <div className="max-h-[65vh] overflow-auto">
            <Table className="min-w-[780px]">
              <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                <TableRow>
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last login</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staff.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <p className="font-medium">{s.name}</p>
                      <p className="text-xs text-muted-foreground">{s.email}</p>
                    </TableCell>
                    <TableCell><Badge variant="outline" className="border-forest/25 text-forest">{s.roleName}</Badge></TableCell>
                    <TableCell className="text-muted-foreground">{s.department ?? "—"}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <StaffStatusBadge status={s.status} />
                        {!s.hasPassword ? <Badge variant="outline" className="text-[10px]">no password</Badge> : null}
                      </div>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">{s.lastLoginAt ? formatDate(s.lastLoginAt) : "never"}</TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label={`Actions for ${s.name}`}>
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-56">
                          {s.status !== "active" ? (
                            <DropdownMenuItem onClick={() => void action(s, "activate")}>
                              <PlayCircle className="h-4 w-4" /> Activate
                            </DropdownMenuItem>
                          ) : null}
                          <DropdownMenuItem onClick={() => setEditing(s)}>
                            <BadgeCheck className="h-4 w-4" /> Role & department
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setPasswordFor(s)}>
                            <KeyRound className="h-4 w-4" /> Set password
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {s.status === "active" ? (
                            <DropdownMenuItem variant="destructive" onClick={() => setSuspending(s)}>
                              <PauseCircle className="h-4 w-4" /> Suspend
                            </DropdownMenuItem>
                          ) : null}
                          {s.status !== "pending" ? (
                            <DropdownMenuItem variant="destructive" onClick={() => setDeactivating(s)}>
                              <UserMinus className="h-4 w-4" /> Deactivate
                            </DropdownMenuItem>
                          ) : null}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <InviteDialog open={inviteOpen} onOpenChange={setInviteOpen} roles={data?.roles ?? []} onInvited={onChanged} />
      <EditStaffDialog staff={editing} roles={data?.roles ?? []} onOpenChange={(o) => !o && setEditing(null)} onSaved={onChanged} />
      <PasswordDialog staff={passwordFor} onOpenChange={(o) => !o && setPasswordFor(null)} onSaved={onChanged} />

      <ConfirmDialog
        open={suspending !== null}
        onOpenChange={(o) => !o && setSuspending(null)}
        title={suspending ? `Suspend ${suspending.name}?` : "Suspend?"}
        description="They are signed out immediately and cannot log in until re-activated."
        confirmLabel="Suspend"
        destructive
        loading={working}
        onConfirm={() => suspending && void action(suspending, "suspend")}
      />
      <ConfirmDialog
        open={deactivating !== null}
        onOpenChange={(o) => !o && setDeactivating(null)}
        title={deactivating ? `Deactivate ${deactivating.name}?` : "Deactivate?"}
        description="Their account returns to pending — invite state. They cannot sign in until activated again."
        confirmLabel="Deactivate"
        destructive
        loading={working}
        onConfirm={() => deactivating && void action(deactivating, "deactivate")}
      />
    </div>
  );
}

function InviteDialog({
  open,
  onOpenChange,
  roles,
  onInvited,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  roles: RoleDTO[];
  onInvited: () => Promise<void>;
}) {
  const { send } = useAdminApi();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [roleId, setRoleId] = useState("");
  const [department, setDepartment] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [invitedName, setInvitedName] = useState("");

  // Reset the invite form each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setInviteToken(null);
      setEmail("");
      setName("");
      setRoleId(roles[0]?.id ?? "");
      setDepartment("");
      setPassword("");
    }
  }

  async function submit() {
    if (!roleId) return toast.error("Choose a role for the new member.");
    setSaving(true);
    const res = await send<{ staff: { name: string }; inviteToken: string }>("/api/admin/staff", "POST", {
      email: email.trim().toLowerCase(),
      name: name.trim(),
      roleId,
      ...(department.trim() ? { department: department.trim() } : {}),
      ...(password.length >= 8 ? { password } : {}),
    });
    setSaving(false);
    if (res) {
      setInviteToken(res.inviteToken);
      setInvitedName(res.staff.name);
      toast.success("Staff member created.");
      await onInvited();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        {inviteToken ? (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Enrollment secret</DialogTitle>
              <DialogDescription>
                Share this one-time token with {invitedName} securely. They enter it with their email on the login screen to set a password
                — or set a password for them directly from the staff table.
              </DialogDescription>
            </DialogHeader>
            <div className="flex items-center gap-2 rounded-xl border border-gold bg-gold/10 p-3">
              <code className="flex-1 break-all font-mono text-sm font-semibold text-forest">{inviteToken}</code>
              <Button
                variant="outline"
                size="icon"
                aria-label="Copy invite token"
                onClick={() => {
                  void navigator.clipboard?.writeText(inviteToken).then(
                    () => toast.success("Token copied."),
                    () => toast.error("Copy failed — select it manually.")
                  );
                }}
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button onClick={() => onOpenChange(false)}>Done</Button>
            </DialogFooter>
          </>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="font-display">Invite a team member</DialogTitle>
              <DialogDescription>You cannot grant permissions you do not hold yourself.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="inv-name">Full name</Label>
                  <Input id="inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ama Mensah" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-email">Work email</Label>
                  <Input id="inv-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="ama@narexfoods.com" />
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Role</Label>
                  <Select value={roleId || undefined} onValueChange={setRoleId}>
                    <SelectTrigger><SelectValue placeholder="Choose a role" /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => (
                        <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="inv-dept">Department (optional)</Label>
                  <Input id="inv-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Kitchen" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="inv-pass">Set password now (optional)</Label>
                <Input id="inv-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Leave blank to use the invite token" />
                <p className="text-xs text-muted-foreground">8+ characters. If set, the member can log in immediately.</p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
              <Button onClick={() => void submit()} disabled={saving || !email.trim() || !name.trim() || !roleId} className="bg-forest text-cream hover:bg-[#23503E]">
                {saving ? "Creating…" : "Create member"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function EditStaffDialog({
  staff,
  roles,
  onOpenChange,
  onSaved,
}: {
  staff: StaffRow | null;
  roles: RoleDTO[];
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const { send } = useAdminApi();
  const [roleId, setRoleId] = useState("");
  const [department, setDepartment] = useState("");
  const [saving, setSaving] = useState(false);

  // Prefill the form whenever a different staff member is opened for editing.
  const [lastStaff, setLastStaff] = useState<StaffRow | null>(null);
  if (staff !== lastStaff) {
    setLastStaff(staff);
    if (staff) {
      setRoleId(staff.roleId);
      setDepartment(staff.department ?? "");
    }
  }

  async function save() {
    if (!staff) return;
    setSaving(true);
    let okAll = true;
    if (roleId !== staff.roleId) {
      const res = await send<{ success: boolean }>("/api/admin/staff", "PATCH", { id: staff.id, action: "set_role", roleId });
      if (res === null) okAll = false;
    }
    if (okAll && department !== (staff.department ?? "")) {
      const res = await send<{ success: boolean }>("/api/admin/staff", "PATCH", { id: staff.id, action: "set_department", department });
      if (res === null) okAll = false;
    }
    setSaving(false);
    if (okAll) {
      toast.success("Staff member updated.");
      onOpenChange(false);
      await onSaved();
    }
  }

  return (
    <Dialog open={staff !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Edit {staff?.name}</DialogTitle>
          <DialogDescription>Role changes apply on their next sign-in.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Role</Label>
            <Select value={roleId || undefined} onValueChange={setRoleId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {roles.map((r) => (
                  <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="st-dept">Department</Label>
            <Input id="st-dept" value={department} onChange={(e) => setDepartment(e.target.value)} placeholder="Front of house" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">{saving ? "Saving…" : "Save"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PasswordDialog({
  staff,
  onOpenChange,
  onSaved,
}: {
  staff: StaffRow | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => Promise<void>;
}) {
  const { send } = useAdminApi();
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  // Clear the password draft whenever a different staff member is targeted.
  const [lastStaff, setLastStaff] = useState<StaffRow | null>(null);
  if (staff !== lastStaff) {
    setLastStaff(staff);
    if (staff) setPassword("");
  }

  async function save() {
    if (!staff) return;
    if (password.length < 8) return toast.error("Password must be at least 8 characters.");
    setSaving(true);
    const res = await send<{ success: boolean }>("/api/admin/staff", "PATCH", { id: staff.id, action: "set_password", password });
    setSaving(false);
    if (res !== null) {
      toast.success(`Password set for ${staff.name}.`);
      onOpenChange(false);
      await onSaved();
    }
  }

  return (
    <Dialog open={staff !== null} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-display">Set password — {staff?.name}</DialogTitle>
          <DialogDescription>Pending members become active as soon as a password is set.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="st-pass">New password</Label>
          <Input id="st-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void save()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">{saving ? "Saving…" : "Set password"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------- Roles matrix ----------------

function RolesTab({ roles, loading, onChanged }: { roles: RoleDTO[] | null; loading: boolean; onChanged: () => Promise<void> }) {
  const { send } = useAdminApi();
  const [createOpen, setCreateOpen] = useState(false);
  const [busyRole, setBusyRole] = useState<string | null>(null);

  async function togglePermission(role: RoleDTO, perm: Permission, next: boolean) {
    if (role.isSystem) {
      toast.error("System roles are protected and cannot be edited.");
      return;
    }
    const permissions = next ? [...role.permissions, perm] : role.permissions.filter((p) => p !== perm);
    setBusyRole(role.id);
    const res = await send<{ success: boolean }>("/api/admin/roles", "PATCH", { id: role.id, permissions });
    setBusyRole(null);
    if (res !== null) {
      toast.success(`${role.name} ${next ? "granted" : "revoked"} “${PERMISSION_LABELS[perm]}”.`);
      await onChanged();
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Flip any cell to grant or revoke. Changes apply to every holder of the role.</p>
        <Button onClick={() => setCreateOpen(true)} variant="outline" className="border-forest/30 text-forest hover:bg-forest/5">
          <UserPlus className="h-4 w-4" /> Create role
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-card shadow-sm">
        {loading && !roles ? (
          <div className="p-4"><SkeletonRows rows={6} /></div>
        ) : (roles ?? []).length === 0 ? (
          <div className="p-4"><EmptyState icon={ShieldCheck} title="No roles found" /></div>
        ) : (
          <div className="overflow-auto">
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 z-10 bg-card">Permission</TableHead>
                  {(roles ?? []).map((r) => (
                    <TableHead key={r.id} className="min-w-[120px] text-center">
                      <p className="font-semibold text-foreground">{r.name}</p>
                      <p className="text-[11px] font-normal text-muted-foreground">
                        {r.staffCount} member{r.staffCount === 1 ? "" : "s"} {r.isSystem ? "· system" : ""}
                      </p>
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {PERMISSIONS.map((perm) => (
                  <TableRow key={perm}>
                    <TableCell className="sticky left-0 z-10 bg-card">
                      <p className="font-medium">{PERMISSION_LABELS[perm]}</p>
                      <p className="font-mono text-[11px] text-muted-foreground">{perm}</p>
                    </TableCell>
                    {(roles ?? []).map((r) => {
                      const has = r.permissions.includes(perm);
                      return (
                        <TableCell key={r.id} className="text-center">
                          {r.isSystem ? (
                            has ? <Lock className="mx-auto h-4 w-4 text-forest" aria-label={`${r.name} holds this (system role)`} /> : <span className="text-xs text-muted-foreground">—</span>
                          ) : (
                            <Checkbox
                              checked={has}
                              disabled={busyRole === r.id}
                              onCheckedChange={(c) => void togglePermission(r, perm, c === true)}
                              aria-label={`${has ? "Revoke" : "Grant"} ${PERMISSION_LABELS[perm]} for ${r.name}`}
                            />
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <CreateRoleDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onChanged} />
    </div>
  );
}

function CreateRoleDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (open: boolean) => void; onCreated: () => Promise<void> }) {
  const { send } = useAdminApi();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [perms, setPerms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Reset the create-role form each time the dialog opens.
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setName("");
      setDescription("");
      setPerms([]);
    }
  }

  async function submit() {
    if (name.trim().length < 2) return toast.error("Role name is too short.");
    setSaving(true);
    const res = await send<{ role: { id: string } }>("/api/admin/roles", "POST", {
      name: name.trim(),
      description: description.trim(),
      permissions: perms,
    });
    setSaving(false);
    if (res) {
      toast.success(`Role “${name.trim()}” created.`);
      onOpenChange(false);
      await onCreated();
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-display">Create a custom role</DialogTitle>
          <DialogDescription>Pick exactly the permissions this role should hold.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="role-name">Name</Label>
            <Input id="role-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Shift Supervisor" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="role-desc">Description</Label>
            <Input id="role-desc" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Runs the floor between 2–10pm" />
          </div>
          <ScrollArea className="max-h-56 rounded-xl border border-border p-3">
            <div className="space-y-2">
              {PERMISSIONS.map((p) => (
                <label key={p} className="flex items-center gap-2.5 text-sm">
                  <Checkbox
                    checked={perms.includes(p)}
                    onCheckedChange={(c) => setPerms((xs) => (c === true ? [...xs, p] : xs.filter((x) => x !== p)))}
                  />
                  <span>
                    {PERMISSION_LABELS[p]}
                    <span className="ml-1 font-mono text-[10px] text-muted-foreground">{p}</span>
                  </span>
                </label>
              ))}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={() => void submit()} disabled={saving} className="bg-forest text-cream hover:bg-[#23503E]">{saving ? "Creating…" : "Create role"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
