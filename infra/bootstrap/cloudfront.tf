# =============================================================================
# Distribuição CloudFront do site (importada em 2026-11-11) e cabeçalhos de
# segurança. O bucket, o OAC, o certificado e a function de redirect continuam
# fora do Terraform e entram aqui por identificador.
#
#   terraform -chdir=infra/bootstrap plan
#   terraform -chdir=infra/bootstrap apply \
#     -target=aws_cloudfront_response_headers_policy.site \
#     -target=aws_cloudfront_distribution.site
# =============================================================================

import {
  to = aws_cloudfront_distribution.site
  id = "E1KARJMUSXKRWK"
}

locals {
  site_origin_id = "gensprintlabs-s3"

  # Mesma política da meta tag de site/*.html, mais frame-ancestors (que só
  # vale por cabeçalho). Mudou uma, mude a outra: tests/site.test.mjs compara.
  content_security_policy = join("; ", [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    "connect-src 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ])
}

resource "aws_cloudfront_response_headers_policy" "site" {
  name    = "gensprint-landing-security-headers"
  comment = "Cabecalhos de seguranca da landing GenSprint"

  security_headers_config {
    # Sem includeSubDomains e sem preload: gensprint.com.br tem subdomínios de
    # outros projetos (refactorai, api) e a landing não decide por eles.
    strict_transport_security {
      access_control_max_age_sec = 31536000
      include_subdomains         = false
      preload                    = false
      override                   = true
    }

    content_type_options {
      override = true
    }

    frame_options {
      frame_option = "DENY"
      override     = true
    }

    referrer_policy {
      referrer_policy = "strict-origin-when-cross-origin"
      override        = true
    }

    content_security_policy {
      content_security_policy = local.content_security_policy
      override                = true
    }
  }

  custom_headers_config {
    items {
      header   = "Permissions-Policy"
      value    = "camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()"
      override = true
    }
  }
}

resource "aws_cloudfront_distribution" "site" {
  enabled             = true
  comment             = "GenSprintLabs Landing Page"
  default_root_object = "index.html"
  http_version        = "http2and3"
  is_ipv6_enabled     = true
  price_class         = "PriceClass_100"

  aliases = [
    "gensprint.com.br",
    "www.gensprint.com.br",
    "gensprintlabs.com.br",
    "www.gensprintlabs.com.br",
  ]

  origin {
    origin_id                = local.site_origin_id
    domain_name              = "${var.site_bucket_name}.s3.us-east-1.amazonaws.com"
    origin_access_control_id = "E2YGPLLJONHQIP" # gitleaks:allow (ID de recurso, não segredo)
  }

  default_cache_behavior {
    target_origin_id           = local.site_origin_id
    viewer_protocol_policy     = "redirect-to-https"
    allowed_methods            = ["GET", "HEAD"]
    cached_methods             = ["GET", "HEAD"]
    compress                   = true
    cache_policy_id            = "658327ea-f89d-4fab-a63d-7e88639e58f6" # Managed-CachingOptimized
    response_headers_policy_id = aws_cloudfront_response_headers_policy.site.id

    # gensprintlabs.com.br e os www redirecionam para gensprint.com.br.
    function_association {
      event_type   = "viewer-request"
      function_arn = "arn:aws:cloudfront::${var.account_id}:function/redirect-gensprintlabs-to-gensprint"
    }
  }

  # O bucket é privado (OAC, sem s3:ListBucket): objeto ausente volta 403 do S3.
  # Os dois códigos viram 404 de verdade com a página do site. Antes de
  # 2026-11-11 o 403 virava /index.html com HTTP 200, o que escondia arquivo
  # ausente e entregava HTML no lugar de CSS, JS ou imagem.
  custom_error_response {
    error_code            = 403
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 60
  }

  custom_error_response {
    error_code            = 404
    response_code         = 404
    response_page_path    = "/404.html"
    error_caching_min_ttl = 60
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = "arn:aws:acm:us-east-1:${var.account_id}:certificate/5eb6ac95-1eb3-405b-8e19-83f927442ec4"
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  lifecycle {
    prevent_destroy = true
  }
}
