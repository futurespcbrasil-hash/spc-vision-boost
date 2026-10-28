using System.Security.Cryptography.X509Certificates;
using System.Text.Json.Serialization;
using SimpleSign.PAdES;
using SimpleSign.PAdES.Signing;
using System.Windows.Forms;

const int Port = 21591;
const int MaxPdfBytes = 20 * 1024 * 1024;
var builder = WebApplication.CreateBuilder(args);
builder.WebHost.UseUrls($"http://127.0.0.1:{Port}");
builder.WebHost.ConfigureKestrel(options => options.Limits.MaxRequestBodySize = 30 * 1024 * 1024);
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});
var app = builder.Build();

var allowedOrigins = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
{
    "https://crm.futuresolucoes.com.br",
    "https://spc-vision-crm.vercel.app",
    "http://localhost:8080",
    "http://127.0.0.1:8080"
};

app.Use(async (context, next) =>
{
    var origin = context.Request.Headers.Origin.ToString();
    if (!string.IsNullOrWhiteSpace(origin))
    {
        if (!allowedOrigins.Contains(origin))
        {
            context.Response.StatusCode = StatusCodes.Status403Forbidden;
            await context.Response.WriteAsJsonAsync(new { error = "Origem não autorizada." });
            return;
        }

        context.Response.Headers.AccessControlAllowOrigin = origin;
        context.Response.Headers.AccessControlAllowMethods = "GET, POST, OPTIONS";
        context.Response.Headers.AccessControlAllowHeaders = "Content-Type";
        context.Response.Headers.Vary = "Origin";
        context.Response.Headers.Append("Access-Control-Allow-Private-Network", "true");
    }

    if (HttpMethods.IsOptions(context.Request.Method))
    {
        context.Response.StatusCode = StatusCodes.Status204NoContent;
        return;
    }

    await next();
});

app.MapGet("/api/health", () => Results.Ok(new
{
    status = "ok",
    product = "Future Assinador Windows",
    version = "0.1.0"
}));

app.MapGet("/api/certificates", () =>
{
    var items = new List<object>();
    using var store = new X509Store(StoreName.My, StoreLocation.CurrentUser);
    store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);

    foreach (var cert in store.Certificates)
    {
        if (!cert.HasPrivateKey) continue;
        if (cert.NotBefore.ToUniversalTime() > DateTime.UtcNow ||
            cert.NotAfter.ToUniversalTime() < DateTime.UtcNow) continue;
        if (cert.Extensions.OfType<X509KeyUsageExtension>().Any(ext =>
            (ext.KeyUsages & (X509KeyUsageFlags.DigitalSignature | X509KeyUsageFlags.NonRepudiation)) == 0)) continue;

        bool canUseKey;
        try
        {
            using var rsa = cert.GetRSAPrivateKey();
            using var ec = rsa is null ? cert.GetECDsaPrivateKey() : null;
            canUseKey = rsa is not null || ec is not null;
        }
        catch
        {
            canUseKey = false;
        }
        if (!canUseKey) continue;

        items.Add(new
        {
            name = cert.GetNameInfo(X509NameType.SimpleName, false),
            subject = cert.Subject,
            issuer = cert.Issuer,
            thumbprint = cert.Thumbprint,
            validFrom = cert.NotBefore.ToString("O"),
            expiresAt = cert.NotAfter.ToString("O"),
            algorithm = cert.GetRSAPublicKey() is not null ? "RSA" : "ECDSA"
        });
    }

    return Results.Ok(items);
});

app.MapPost("/api/sign-pdf", async (SignRequest request) =>
{
    if (string.IsNullOrWhiteSpace(request.Thumbprint))
        return Results.BadRequest(new { error = "Selecione um certificado instalado." });
    if (string.IsNullOrWhiteSpace(request.PdfBase64))
        return Results.BadRequest(new { error = "O PDF não foi recebido." });
    if (request.Page < 1 || request.Page > 1000 || request.X < 0 || request.Y < 0)
        return Results.BadRequest(new { error = "A posição da assinatura é inválida." });

    byte[] pdfBytes;
    try
    {
        pdfBytes = Convert.FromBase64String(request.PdfBase64);
    }
    catch (FormatException)
    {
        return Results.BadRequest(new { error = "O conteúdo do PDF está inválido." });
    }

    if (pdfBytes.Length < 5 || !pdfBytes.AsSpan(0, 5).SequenceEqual("%PDF-"u8))
        return Results.BadRequest(new { error = "O arquivo enviado não é um PDF válido." });
    if (pdfBytes.Length > MaxPdfBytes)
        return Results.BadRequest(new { error = "O PDF excede o limite de 20 MB." });

    using var store = new X509Store(StoreName.My, StoreLocation.CurrentUser);
    store.Open(OpenFlags.ReadOnly | OpenFlags.OpenExistingOnly);
    var matches = store.Certificates.Find(X509FindType.FindByThumbprint, request.Thumbprint.Replace(" ", ""), false);
    if (matches.Count == 0)
        return Results.BadRequest(new { error = "O certificado selecionado não está mais disponível no repositório do Windows." });

    var certificate = matches[0];
    if (!certificate.HasPrivateKey)
        return Results.BadRequest(new { error = "O certificado não possui chave privada acessível." });
    if (certificate.NotAfter.ToUniversalTime() < DateTime.UtcNow)
        return Results.BadRequest(new { error = "O certificado selecionado está vencido." });

    var documentName = SafeFileName(request.FileName);
    var signerName = certificate.GetNameInfo(X509NameType.SimpleName, false);
    var confirmation = MessageBox.Show(
        "O site Future Assinador solicitou uma assinatura digital neste computador.\\n\\n" +
        "Documento: " + documentName + "\\n" +
        "Certificado: " + signerName + "\\n" +
        "Página: " + request.Page + "\\n\\n" +
        "A chave privada permanecerá no Windows. Deseja autorizar esta assinatura?",
        "Future Assinador — confirmar assinatura",
        MessageBoxButtons.OKCancel,
        MessageBoxIcon.Warning,
        MessageBoxDefaultButton.Button2);
    if (confirmation != DialogResult.OK)
        return Results.BadRequest(new { error = "Assinatura cancelada no computador pelo usuário." });

    try
    {
        var builder = PadesSigner.Document(pdfBytes)
            .WithCertificate(certificate)
            .WithFieldOptions(new SignatureFieldOptions
            {
                SignerName = certificate.GetNameInfo(X509NameType.SimpleName, false),
                Reason = "Assinatura digital"
            })
            .WithAppearance(new SignatureAppearance
            {
                Page = request.Page,
                X = request.X,
                Y = request.Y,
                ShowDate = true,
                ShowReason = false
            });

        var signedPdf = await builder.SignAsync();
        return Results.Ok(new
        {
            fileName = string.IsNullOrWhiteSpace(request.FileName) ? "documento-assinado.pdf" : SafeFileName(request.FileName),
            signedPdfBase64 = Convert.ToBase64String(signedPdf),
            bytes = signedPdf.Length,
            signer = certificate.GetNameInfo(X509NameType.SimpleName, false)
        });
    }
    catch (Exception ex)
    {
        app.Logger.LogError(ex, "Falha ao assinar PDF localmente com certificado {Thumbprint}", certificate.Thumbprint);
        return Results.BadRequest(new { error = FriendlyError(ex) });
    }
});

app.Logger.LogInformation("Future Assinador Windows v0.1.0 iniciado em http://127.0.0.1:{Port}", Port);
app.Logger.LogInformation("A chave privada permanece no repositório de certificados do Windows.");
await app.RunAsync();

static string SafeFileName(string name)
{
    var safe = Path.GetFileName(name);
    foreach (var c in Path.GetInvalidFileNameChars()) safe = safe.Replace(c, '_');
    return safe.EndsWith(".pdf", StringComparison.OrdinalIgnoreCase) ? safe : safe + ".pdf";
}

static string FriendlyError(Exception ex)
{
    var message = ex.GetBaseException().Message;
    if (message.Contains("private key", StringComparison.OrdinalIgnoreCase) ||
        message.Contains("chave privada", StringComparison.OrdinalIgnoreCase) ||
        message.Contains("access was denied", StringComparison.OrdinalIgnoreCase))
        return "O Windows não permitiu usar a chave privada. Confirme se o certificado está válido e se a chave está acessível para este usuário.";
    if (message.Contains("password", StringComparison.OrdinalIgnoreCase) ||
        message.Contains("senha", StringComparison.OrdinalIgnoreCase))
        return "O provedor do certificado solicitou credencial ou PIN e a operação não foi concluída.";
    return $"Não foi possível assinar: {message}";
}

internal sealed record SignRequest(
    string Thumbprint,
    string PdfBase64,
    string FileName,
    int Page,
    float X,
    float Y);
