# =============================================================================
# GenSprint Labs — landing page: bootstrap (role OIDC do GitHub Actions)
# =============================================================================
# Única infraestrutura administrada por este repositório hoje. O bucket do site
# (gensprintlabs-frontend-production) e a distribuição CloudFront (E1KARJMUSXKRWK)
# foram criados antes deste repositório ter Terraform e ainda não foram
# importados: ver docs/adr/001-ci-cd-por-github-actions-oidc.md.
#
# Quem roda: o dono, com o perfil SSO `felipelageduarte` (admin). Nunca o CI:
# a role de deploy não pode editar a própria policy.
#
#   terraform -chdir=infra/bootstrap init
#   terraform -chdir=infra/bootstrap plan
#   terraform -chdir=infra/bootstrap apply -target=aws_iam_role.deploy \
#     -target=aws_iam_role_policy.deploy
# =============================================================================

terraform {
  required_version = ">= 1.5"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.38"
    }
  }

  # State no bucket da GenSprint (já existente, versionado), com chave própria.
  backend "s3" {
    bucket         = "gensprint-terraform-state"
    key            = "landingpage/bootstrap/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "gensprint-terraform-locks"
    encrypt        = true
  }
}

provider "aws" {
  region = "us-east-1"

  # Trava de conta: um apply com o perfil errado falha no plan.
  allowed_account_ids = [var.account_id]

  default_tags {
    tags = {
      Project   = "gensprint-landingpage"
      ManagedBy = "terraform-bootstrap"
    }
  }
}

variable "account_id" {
  description = "Conta AWS da GenSprint."
  type        = string
  default     = "220395825071"
}

variable "github_repo" {
  description = "Repositório GitHub (owner/nome) autorizado a assumir a role de deploy."
  type        = string
  default     = "GenSprint-Labs/landingpage"
}

variable "site_bucket_name" {
  description = "Bucket S3 de origem do site."
  type        = string
  default     = "gensprintlabs-frontend-production"
}

variable "distribution_id" {
  description = "Distribuição CloudFront do site."
  type        = string
  default     = "E1KARJMUSXKRWK"
}

output "deploy_role_arn" {
  description = "Valor da variável de repositório AWS_DEPLOY_ROLE_ARN."
  value       = aws_iam_role.deploy.arn
}
