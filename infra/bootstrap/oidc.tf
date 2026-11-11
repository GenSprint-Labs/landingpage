# =============================================================================
# GitHub Actions OIDC — role de deploy da landing page
# =============================================================================
# O provider OIDC `token.actions.githubusercontent.com` já existe na conta
# (criado por outro projeto): aqui só é lido, nunca administrado.
#
# O repositório é PÚBLICO. Por isso a role só é assumível pelo environment
# `production` (restrito ao branch `main` no GitHub), nunca por `pull_request`:
# um PR de fork não consegue credencial AWS.
#
# Formato do `sub`: o GitHub emite o clássico (`repo:ORG/REPO:...`) ou o
# imutável com IDs (`repo:ORG@ID/REPO@ID:...`). Os dois são aceitos, e o claim
# `repository` reforça o escopo.
#
# Permissões: o mínimo para publicar arquivos estáticos e invalidar o cache.
# Nenhuma permissão de IAM, de configuração do bucket ou da distribuição.
# =============================================================================

data "aws_iam_openid_connect_provider" "github" {
  url = "https://token.actions.githubusercontent.com"
}

locals {
  repo_owner = split("/", var.github_repo)[0]
  repo_name  = split("/", var.github_repo)[1]

  sub_deploy = [
    "repo:${var.github_repo}:environment:production",
    "repo:${local.repo_owner}@*/${local.repo_name}@*:environment:production",
  ]
}

data "aws_iam_policy_document" "trust_deploy" {
  statement {
    effect  = "Allow"
    actions = ["sts:AssumeRoleWithWebIdentity"]

    principals {
      type        = "Federated"
      identifiers = [data.aws_iam_openid_connect_provider.github.arn]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:aud"
      values   = ["sts.amazonaws.com"]
    }

    condition {
      test     = "StringEquals"
      variable = "token.actions.githubusercontent.com:repository"
      values   = [var.github_repo]
    }

    condition {
      test     = "StringLike"
      variable = "token.actions.githubusercontent.com:sub"
      values   = local.sub_deploy
    }
  }
}

resource "aws_iam_role" "deploy" {
  name                 = "GenSprintLandingGitHubDeployRole"
  description          = "deploy.yml do GenSprint-Labs/landingpage (environment production)"
  assume_role_policy   = data.aws_iam_policy_document.trust_deploy.json
  max_session_duration = 3600
}

data "aws_iam_policy_document" "deploy" {
  statement {
    sid       = "ListSiteBucket"
    effect    = "Allow"
    actions   = ["s3:ListBucket", "s3:GetBucketLocation"]
    resources = ["arn:aws:s3:::${var.site_bucket_name}"]
  }

  statement {
    sid       = "PublishSiteObjects"
    effect    = "Allow"
    actions   = ["s3:GetObject", "s3:PutObject", "s3:DeleteObject"]
    resources = ["arn:aws:s3:::${var.site_bucket_name}/*"]
  }

  statement {
    sid       = "InvalidateSiteCache"
    effect    = "Allow"
    actions   = ["cloudfront:CreateInvalidation", "cloudfront:GetInvalidation"]
    resources = ["arn:aws:cloudfront::${var.account_id}:distribution/${var.distribution_id}"]
  }
}

resource "aws_iam_role_policy" "deploy" {
  name   = "publish-static-site"
  role   = aws_iam_role.deploy.id
  policy = data.aws_iam_policy_document.deploy.json
}
