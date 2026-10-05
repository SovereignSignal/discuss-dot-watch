import {getDb,isDatabaseConfigured} from './db';

/** Read-only preflight. Schema upgrades remain an explicit authenticated action. */
export async function corpusSchemaState():Promise<{ready:boolean;upgradeRequired:boolean}> {
  if(!isDatabaseConfigured())return {ready:false,upgradeRequired:false};
  const rows=await getDb()`SELECT
    to_regclass('public.topic_documents') IS NOT NULL
    AND to_regclass('public.corpus_jobs') IS NOT NULL
    AND (SELECT count(*) FROM information_schema.columns
      WHERE table_schema='public' AND table_name='corpus_jobs'
        AND column_name IN('max_topics','max_pages'))=2 AS ready`;
  const ready=rows[0]?.ready===true;
  return {ready,upgradeRequired:!ready};
}
