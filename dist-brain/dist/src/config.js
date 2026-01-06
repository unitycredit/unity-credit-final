import 'dotenv/config';
export function env(name, fallback = '') {
    return String(process.env[name] || fallback).trim();
}
export function envInt(name, fallback) {
    const raw = env(name, '');
    if (!raw)
        return fallback;
    const n = Number(raw);
    return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
export const cfg = {
    // AWS App Runner expects the service to listen on PORT (commonly 8080).
    port: envInt('PORT', 8080),
    upstreamBrainUrl: env('UPSTREAM_BRAIN_API_URL', env('BRAIN_API_URL', env('UNITY_BRAIN_URL', ''))),
    upstreamLicenseKey: env('UPSTREAM_BRAIN_LICENSE_KEY', env('MASTER_BRAIN_KEY', env('UNITY_BRAIN_LICENSE_KEY', env('UNITY_BRAIN_KEY', '')))),
    unityAppId: env('UNITY_APP_ID', 'UnityCredit-01'),
    unityAppDomain: env('UNITY_APP_DOMAIN', ''),
    supabaseUrl: env('SUPABASE_URL', env('NEXT_PUBLIC_SUPABASE_URL', '')),
    supabaseServiceRoleKey: env('SUPABASE_SERVICE_ROLE_KEY', env('SUPABASE_SERVICE_ROLE_KEY', '')),
};
