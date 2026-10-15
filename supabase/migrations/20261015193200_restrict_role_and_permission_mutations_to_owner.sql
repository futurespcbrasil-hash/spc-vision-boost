DROP POLICY IF EXISTS "Managers can manage module permissions" ON public.user_module_permissions;
CREATE POLICY "Owner can manage module permissions"
ON public.user_module_permissions FOR ALL TO authenticated
USING ((auth.jwt() ->> 'email') = 'dalprapf1@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'dalprapf1@gmail.com');

DROP POLICY IF EXISTS "roles manage by gestor" ON public.user_roles;
CREATE POLICY "Owner can manage user roles"
ON public.user_roles FOR ALL TO authenticated
USING ((auth.jwt() ->> 'email') = 'dalprapf1@gmail.com')
WITH CHECK ((auth.jwt() ->> 'email') = 'dalprapf1@gmail.com');
