drop policy "Permitir acesso a roles" on public.user_roles;
create policy "roles select" on public.user_roles for select to authenticated using (true);
create policy "roles manage by gestor" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'gestor')) with check (public.has_role(auth.uid(), 'gestor'));

drop policy "Permitir acesso a setores" on public.sectors;
create policy "sectors select" on public.sectors for select to authenticated using (true);
create policy "sectors manage by gestor" on public.sectors for all to authenticated
  using (public.has_role(auth.uid(), 'gestor')) with check (public.has_role(auth.uid(), 'gestor'));