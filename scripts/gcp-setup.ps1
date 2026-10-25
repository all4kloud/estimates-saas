<#
  Configuración única de Google Cloud para Estimates & Invoices (Cloud Run + GitHub Actions).
  Se puede volver a correr: lo que ya existe se deja igual.

  Requisitos: gcloud instalado y con sesión (gcloud auth login), y un proyecto de GCP
  de all4kloud con facturación activa.

  Uso (PowerShell):
    .\scripts\gcp-setup.ps1 -ProjectId all4kloud-estimates
    .\scripts\gcp-setup.ps1 -ProjectId all4kloud-estimates -Region us-east1 -GitHubRepo all4kloud/estimates-saas
#>
param(
  [Parameter(Mandatory = $true)] [string] $ProjectId,
  [string] $Region = 'us-east1',
  [string] $GitHubRepo = 'all4kloud/estimates-saas'
)
$ErrorActionPreference = 'Stop'

function G {
  # ejecuta gcloud y se detiene si falla
  & gcloud @args
  if ($LASTEXITCODE -ne 0) { throw "Falló: gcloud $($args -join ' ')" }
}
function Exists {
  # true si el comando 'describe' encuentra el recurso
  # (en Windows PowerShell 5.1, redirigir stderr con 'Stop' activo lanza excepción: se baja a 'Continue')
  $prev = $ErrorActionPreference
  $ErrorActionPreference = 'Continue'
  try { & gcloud @args *> $null } finally { $ErrorActionPreference = $prev }
  return ($LASTEXITCODE -eq 0)
}

$RuntimeSa = "estimates-runtime@$ProjectId.iam.gserviceaccount.com"
$DeploySa  = "estimates-deploy@$ProjectId.iam.gserviceaccount.com"
$Pool      = 'github-pool'
$Provider  = 'github-provider'

Write-Host "== Proyecto $ProjectId ($Region)" -ForegroundColor Cyan
G config set project $ProjectId
$ProjectNumber = (& gcloud projects describe $ProjectId --format='value(projectNumber)').Trim()

Write-Host '== Activando APIs' -ForegroundColor Cyan
G services enable run.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com `
  iam.googleapis.com iamcredentials.googleapis.com sts.googleapis.com cloudresourcemanager.googleapis.com

Write-Host '== Artifact Registry' -ForegroundColor Cyan
if (-not (Exists artifacts repositories describe estimates --location=$Region)) {
  G artifacts repositories create estimates --repository-format=docker --location=$Region `
    --description='Imagenes de Estimates and Invoices'
}

Write-Host '== Cuentas de servicio' -ForegroundColor Cyan
if (-not (Exists iam service-accounts describe $RuntimeSa)) {
  G iam service-accounts create estimates-runtime --display-name='Estimates runtime (Cloud Run)'
}
if (-not (Exists iam service-accounts describe $DeploySa)) {
  G iam service-accounts create estimates-deploy --display-name='Estimates deploy (GitHub Actions)'
}
# deploy: desplegar Cloud Run, subir imágenes y "actuar como" la cuenta de runtime
G projects add-iam-policy-binding $ProjectId --member="serviceAccount:$DeploySa" --role=roles/run.admin --condition=None --quiet | Out-Null
G artifacts repositories add-iam-policy-binding estimates --location=$Region `
  --member="serviceAccount:$DeploySa" --role=roles/artifactregistry.writer --quiet | Out-Null
G iam service-accounts add-iam-policy-binding $RuntimeSa `
  --member="serviceAccount:$DeploySa" --role=roles/iam.serviceAccountUser --quiet | Out-Null

Write-Host '== Workload Identity Federation (GitHub sin llaves JSON)' -ForegroundColor Cyan
if (-not (Exists iam workload-identity-pools describe $Pool --location=global)) {
  G iam workload-identity-pools create $Pool --location=global --display-name='GitHub Actions'
}
if (-not (Exists iam workload-identity-pools providers describe $Provider --location=global --workload-identity-pool=$Pool)) {
  G iam workload-identity-pools providers create-oidc $Provider --location=global --workload-identity-pool=$Pool `
    --display-name='GitHub' --issuer-uri='https://token.actions.githubusercontent.com' `
    --attribute-mapping='google.subject=assertion.sub,attribute.repository=assertion.repository' `
    --attribute-condition="assertion.repository=='$GitHubRepo'"
}
G iam service-accounts add-iam-policy-binding $DeploySa --role=roles/iam.workloadIdentityUser `
  --member="principalSet://iam.googleapis.com/projects/$ProjectNumber/locations/global/workloadIdentityPools/$Pool/attribute.repository/$GitHubRepo" `
  --quiet | Out-Null

Write-Host '== Secretos (Secret Manager)' -ForegroundColor Cyan
Write-Host '   Deja vacío lo que todavía no tengas: se guarda NOT_SET y la app lo trata como no configurado.'
$Secrets = [ordered]@{
  'supabase-service-role-key'     = 'Supabase service_role key (Project Settings -> API)'
  'resend-api-key'                = 'Resend API key (re_...)'
  'stripe-secret-key'             = 'Stripe secret key (sk_live_... o sk_test_...)'
  'stripe-connect-webhook-secret' = 'Stripe webhook de Connect (whsec_...)'
  'stripe-billing-webhook-secret' = 'Stripe webhook de suscripciones (whsec_...)'
}
foreach ($name in $Secrets.Keys) {
  if (Exists secrets describe $name) {
    Write-Host "   $name ya existe (para cambiarlo: gcloud secrets versions add $name --data-file=archivo)"
  } else {
    $secure = Read-Host -AsSecureString "   $($Secrets[$name])"
    $bstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($secure)
    $plain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($bstr)
    [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($bstr)
    if ([string]::IsNullOrWhiteSpace($plain)) { $plain = 'NOT_SET' }
    $tmp = [IO.Path]::GetTempFileName()
    try {
      [IO.File]::WriteAllText($tmp, $plain.Trim())
      G secrets create $name --replication-policy=automatic --data-file=$tmp | Out-Null
    } finally {
      Remove-Item $tmp -Force
      $plain = $null
    }
  }
  G secrets add-iam-policy-binding $name --member="serviceAccount:$RuntimeSa" `
    --role=roles/secretmanager.secretAccessor --quiet | Out-Null
}

$WifProvider = "projects/$ProjectNumber/locations/global/workloadIdentityPools/$Pool/providers/$Provider"
Write-Host ''
Write-Host "== Listo. Crea estas Variables en GitHub ($GitHubRepo -> Settings -> Secrets and variables -> Actions -> Variables):" -ForegroundColor Green
Write-Host "   GCP_PROJECT_ID               = $ProjectId"
Write-Host "   GCP_REGION                   = $Region"
Write-Host "   WIF_PROVIDER                 = $WifProvider"
Write-Host "   DEPLOY_SA                    = $DeploySa"
Write-Host "   RUNTIME_SA                   = $RuntimeSa"
Write-Host '   NEXT_PUBLIC_SUPABASE_URL     = https://<proyecto>.supabase.co'
Write-Host '   NEXT_PUBLIC_SUPABASE_ANON_KEY= <anon key de Supabase>'
Write-Host '   NEXT_PUBLIC_APP_URL          = https://estimates.all4kloud.net'
Write-Host '   RESEND_FROM_EMAIL            = estimates@all4kloud.net'
Write-Host '   STRIPE_PRICE_ID              = price_... (plan anual de $100)'
Write-Host '   TRIAL_DAYS                   = 14'
Write-Host '   PLAN_PRICE_LABEL             = $100'
Write-Host '   PLATFORM_FEE_PERCENT         = 0'
