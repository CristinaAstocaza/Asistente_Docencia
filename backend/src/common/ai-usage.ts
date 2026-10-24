// Internal stages are metered for tokens but are not separate user requests.
// Exclude existing rows as well, so earlier page retries no longer exhaust the daily allowance.
export const userRequestFilter="request_type NOT LIKE 'embedding_%' AND request_type NOT IN ('guide_page','guide_image','template_design')";
export const limaDayStart="date_trunc('day',now() AT TIME ZONE 'America/Lima') AT TIME ZONE 'America/Lima'";
export const internalAIStages=new Set(['guide_page','guide_image','template_design']);
