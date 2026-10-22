-- The old deployed Kanban still renders hard-coded stages. Remove only the newly seeded default rows
-- until the new DB-driven Kanban bundle is successfully deployed, avoiding duplicate columns.
DELETE FROM public.kanban_stages
WHERE user_id = '33b9e710-594d-4811-8e94-ba87507cf556'::uuid
  AND funnel IN ('spc', 'sector_1792593091797', 'sector_1778269924785')
  AND key IN (
    'lead_novo','contato_realizado','comparacao_enviada','em_negociacao',
    'fechamento','venda_ganha','venda_perdida','nao_utiliza_consulta','retornar_contato'
  );
