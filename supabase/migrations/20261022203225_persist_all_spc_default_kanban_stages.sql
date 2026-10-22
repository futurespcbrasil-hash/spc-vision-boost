UPDATE public.kanban_stages
SET position = position + 20
WHERE funnel = 'spc' AND key LIKE 'custom\_%' ESCAPE '\';

WITH defaults(key,label,color,position) AS (
  VALUES
    ('lead_novo','Lead Novo','bg-kanban-lead',0),
    ('contato_realizado','Contato Realizado','bg-kanban-contact',1),
    ('comparacao_enviada','Comparação Enviada','bg-kanban-sent',2),
    ('em_negociacao','Em Negociação','bg-kanban-negotiation',3),
    ('fechamento','Fechamento','bg-kanban-closing',4),
    ('venda_ganha','Venda Ganha','bg-kanban-won',5),
    ('venda_perdida','Venda Perdida','bg-kanban-lost',6),
    ('nao_utiliza_consulta','Não Utiliza Consulta','bg-kanban-no-use',7),
    ('retornar_contato','Retornar Contato','bg-kanban-return',8)
)
INSERT INTO public.kanban_stages(user_id, funnel, key, label, color, position)
SELECT '33b9e710-594d-4811-8e94-ba87507cf556'::uuid, 'spc', d.key, d.label, d.color, d.position
FROM defaults d
WHERE NOT EXISTS (
  SELECT 1 FROM public.kanban_stages s WHERE s.funnel='spc' AND s.key=d.key
);
