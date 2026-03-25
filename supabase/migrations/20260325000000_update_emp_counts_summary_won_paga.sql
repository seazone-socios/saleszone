-- Atualiza get_emp_counts_summary para excluir source='won_paga' dos counts regulares.
-- won_paga é uma source separada usada para contagem real de wons de mídia paga
-- (rd_source ILIKE '%paga%'), calculada no sync daily-won. Sem este filtro,
-- os counts regulares (Todos) seriam inflados quando won_paga rows existirem.
CREATE OR REPLACE FUNCTION get_emp_counts_summary(p_start_date date)
RETURNS TABLE (
  empreendimento text,
  mql_life       bigint,
  sql_life       bigint,
  opp_life       bigint,
  won_life       bigint,
  mql_month      bigint,
  sql_month      bigint,
  opp_month      bigint,
  won_month      bigint
) AS $$
  SELECT
    empreendimento,
    SUM(CASE WHEN tab = 'mql' AND source != 'won_paga' THEN count ELSE 0 END)::bigint AS mql_life,
    SUM(CASE WHEN tab = 'sql' AND source != 'won_paga' THEN count ELSE 0 END)::bigint AS sql_life,
    SUM(CASE WHEN tab = 'opp' AND source != 'won_paga' THEN count ELSE 0 END)::bigint AS opp_life,
    SUM(CASE WHEN tab = 'won' AND source != 'won_paga' THEN count ELSE 0 END)::bigint AS won_life,
    SUM(CASE WHEN tab = 'mql' AND source != 'won_paga' AND date >= p_start_date THEN count ELSE 0 END)::bigint AS mql_month,
    SUM(CASE WHEN tab = 'sql' AND source != 'won_paga' AND date >= p_start_date THEN count ELSE 0 END)::bigint AS sql_month,
    SUM(CASE WHEN tab = 'opp' AND source != 'won_paga' AND date >= p_start_date THEN count ELSE 0 END)::bigint AS opp_month,
    SUM(CASE WHEN tab = 'won' AND source != 'won_paga' AND date >= p_start_date THEN count ELSE 0 END)::bigint AS won_month
  FROM squad_daily_counts
  WHERE empreendimento IS NOT NULL
  GROUP BY empreendimento
  ORDER BY empreendimento;
$$ LANGUAGE sql STABLE;
