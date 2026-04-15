def resolveImageName(String registry, String namespace, String component, String tag) {
  def repository = "${namespace}/${component}:${tag}"
  return registry?.trim() ? "${registry.trim()}/${repository}" : repository
}

def dockerCli() {
  return isUnix() ? 'docker' : '"C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe"'
}

def runCommand(String unixCommand, String windowsCommand = null) {
  if (isUnix()) {
    sh unixCommand
    return
  }

  bat(script: "@echo off\r\n${windowsCommand ?: unixCommand}")
}

def captureCommand(String unixCommand, String windowsCommand = null) {
  if (isUnix()) {
    return sh(script: unixCommand, returnStdout: true).trim()
  }

  def output = bat(
    script: "@echo off\r\n${windowsCommand ?: unixCommand}",
    returnStdout: true,
  ).trim()

  def lines = output.readLines().findAll { it?.trim() }
  return lines ? lines[-1].trim() : ''
}

def composeCommand(String projectName, String subcommand) {
  if (isUnix()) {
    return "COMPOSE_PROJECT_NAME=${projectName} ${dockerCli()} compose ${subcommand}"
  }

  return "set \"COMPOSE_PROJECT_NAME=${projectName}\" && ${dockerCli()} compose ${subcommand}"
}

pipeline {
  agent any

  options {
    ansiColor('xterm')
    timestamps()
  }

  parameters {
    booleanParam(name: 'PUSH_IMAGES', defaultValue: false, description: 'Push built Docker images to a registry.')
    booleanParam(name: 'DEPLOY_WITH_COMPOSE', defaultValue: false, description: 'Deploy the stack locally on the Jenkins agent with docker compose.')
    string(name: 'DOCKER_REGISTRY', defaultValue: '', description: 'Registry host, for example registry.example.com. Leave blank for Docker Hub.')
    string(name: 'DOCKER_NAMESPACE', defaultValue: 'fitsync', description: 'Namespace or repository prefix for built images.')
    string(name: 'DOCKER_CREDENTIALS_ID', defaultValue: '', description: 'Jenkins username/password credentials ID used when PUSH_IMAGES is enabled.')
    string(name: 'IMAGE_TAG', defaultValue: '', description: 'Optional image tag override. Defaults to BUILD_NUMBER-short_sha.')
    string(name: 'DEPLOY_COMPOSE_PROJECT', defaultValue: 'fitsync', description: 'Compose project name to use for local deployment.')
  }

  environment {
    DOCKER_BUILDKIT = '1'
    COMPOSE_DOCKER_CLI_BUILD = '1'
    NODE_ENV = 'test'
    PORT = '4000'
    MONGODB_URI = 'mongodb://127.0.0.1:27017/fitsync_test'
    CORS_ORIGIN = 'http://localhost:8080,http://localhost:4000'
    CLIENT_BASE_URL = 'http://localhost:8080'
    JWT_SECRET = 'jenkins-jwt-secret'
    REFRESH_TOKEN_SECRET = 'jenkins-refresh-secret'
    STRIPE_PUBLISHABLE_KEY = 'pk_test_dummy'
    STRIPE_SECRET_KEY = 'sk_test_dummy'
    STRIPE_WEBHOOK_SECRET = 'whsec_dummy'
  }

  stages {
    stage('Checkout') {
      steps {
        script {
          if (env.FITSYNC_LOCAL_SOURCE?.trim()) {
            def localUnixCopy = '''
            set -e
            if [ ! -d "$FITSYNC_LOCAL_SOURCE" ]; then
              echo "Local source path '$FITSYNC_LOCAL_SOURCE' does not exist" >&2
              exit 1
            fi
            find . -mindepth 1 -maxdepth 1 -exec rm -rf {} +
            tar -C "$FITSYNC_LOCAL_SOURCE" \
              --exclude='.git' \
              --exclude='node_modules' \
              --exclude='client/node_modules' \
              --exclude='client/dist' \
              --exclude='client/.vite' \
              --exclude='src/logs' \
              --exclude='src/storage/uploads' \
              -cf - . | tar -xf -
            '''.stripIndent().trim()

            def localWindowsCopy = '''
            if not exist "%FITSYNC_LOCAL_SOURCE%" exit /b 1
            powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; Get-ChildItem -Force | Remove-Item -Force -Recurse -ErrorAction SilentlyContinue; Copy-Item -Path \"$env:FITSYNC_LOCAL_SOURCE\\*\" -Destination . -Recurse -Force; if (Test-Path \"$env:FITSYNC_LOCAL_SOURCE\\.git\") { Copy-Item -Path \"$env:FITSYNC_LOCAL_SOURCE\\.git\" -Destination . -Recurse -Force }"
            '''.stripIndent().trim()

            runCommand(
              localUnixCopy,
              localWindowsCopy,
            )
          } else {
            checkout scm
          }

          if (env.FITSYNC_LOCAL_SOURCE?.trim()) {
            env.GIT_COMMIT_SHORT = captureCommand(
              "git -C \"${env.FITSYNC_LOCAL_SOURCE}\" rev-parse --short=12 HEAD",
              'git -C "%FITSYNC_LOCAL_SOURCE%" rev-parse --short=12 HEAD',
            )
            env.MONGODB_URI = 'mongodb://host.docker.internal:27017/fitsync_test'
          } else {
            env.GIT_COMMIT_SHORT = captureCommand(
              'git rev-parse --short=12 HEAD',
              'git rev-parse --short=12 HEAD',
            )
          }
          env.RESOLVED_IMAGE_TAG = params.IMAGE_TAG?.trim() ? params.IMAGE_TAG.trim() : "${env.BUILD_NUMBER}-${env.GIT_COMMIT_SHORT}"
          env.CI_COMPOSE_PROJECT = "fitsync-ci-${env.BUILD_NUMBER}"
          env.API_IMAGE = resolveImageName(params.DOCKER_REGISTRY, params.DOCKER_NAMESPACE, 'api', env.RESOLVED_IMAGE_TAG)
          env.WEB_IMAGE = resolveImageName(params.DOCKER_REGISTRY, params.DOCKER_NAMESPACE, 'web', env.RESOLVED_IMAGE_TAG)
        }
      }
    }

    stage('Install') {
      steps {
        script {
          runCommand('npm ci', 'npm ci')
        }
        dir('client') {
          script {
            runCommand('npm ci', 'npm ci')
          }
        }
      }
    }

    stage('Start Mongo') {
      steps {
        script {
          if (env.FITSYNC_LOCAL_SOURCE?.trim()) {
            echo 'Using existing Docker Desktop MongoDB through host.docker.internal for the local Jenkins controller.'
            return
          }

          def unixStartMongo = (
            '''
            set -e
            ''' +
            composeCommand(env.CI_COMPOSE_PROJECT, 'up -d mongo') +
            '''
            mongo_id="$(''' +
            composeCommand(env.CI_COMPOSE_PROJECT, 'ps -q mongo') +
            ''')"
            if [ -z "$mongo_id" ]; then
              echo "Mongo container not found" >&2
              exit 1
            fi
            for _ in $(seq 1 90); do
              status="$(''' +
            dockerCli() +
            ''' inspect -f '{{.State.Health.Status}}' "$mongo_id")"
              if [ "$status" = "healthy" ]; then
                exit 0
              fi
              sleep 2
            done
            echo "Mongo container did not become healthy" >&2
            exit 1
            '''
          ).stripIndent().trim()

          def windowsStartMongo = (
            composeCommand(env.CI_COMPOSE_PROJECT, 'up -d mongo') +
            '''
            
            powershell -NoProfile -Command "$container = (& 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe' compose ps -q mongo).Trim(); if (-not $container) { throw 'Mongo container not found' }; $deadline = (Get-Date).AddMinutes(3); while ((Get-Date) -lt $deadline) { $status = (& 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe' inspect -f '{{.State.Health.Status}}' $container).Trim(); if ($status -eq 'healthy') { exit 0 }; Start-Sleep -Seconds 2 }; throw 'Mongo container did not become healthy'"
            '''
          ).stripIndent().trim()

          runCommand(
            unixStartMongo,
            windowsStartMongo,
          )
        }
      }
    }

    stage('Test') {
      steps {
        script {
          runCommand('npm test', 'npm test')
        }
      }
    }

    stage('Build Client') {
      steps {
        dir('client') {
          script {
            runCommand('npm run build', 'npm run build')
          }
        }
      }
    }

    stage('Build Images') {
      steps {
        script {
          runCommand(
            "${dockerCli()} build -t \"${env.API_IMAGE}\" .\n${dockerCli()} build -f client/Dockerfile -t \"${env.WEB_IMAGE}\" ./client",
            "${dockerCli()} build -t \"${env.API_IMAGE}\" .\r\n${dockerCli()} build -f client/Dockerfile -t \"${env.WEB_IMAGE}\" ./client",
          )
        }
      }
    }

    stage('Push Images') {
      when {
        expression { params.PUSH_IMAGES && params.DOCKER_CREDENTIALS_ID?.trim() }
      }
      steps {
        withCredentials([usernamePassword(credentialsId: params.DOCKER_CREDENTIALS_ID, usernameVariable: 'DOCKER_USER', passwordVariable: 'DOCKER_PASSWORD')]) {
          script {
            def unixPushImages = (
              '''
              set -e
              if [ -n "$DOCKER_REGISTRY" ]; then
                echo "$DOCKER_PASSWORD" | ''' +
              dockerCli() +
              ''' login "$DOCKER_REGISTRY" --username "$DOCKER_USER" --password-stdin
              else
                echo "$DOCKER_PASSWORD" | ''' +
              dockerCli() +
              ''' login --username "$DOCKER_USER" --password-stdin
              fi
              ''' +
              dockerCli() +
              ''' push "$API_IMAGE"
              ''' +
              dockerCli() +
              ''' push "$WEB_IMAGE"
              '''
            ).stripIndent().trim()

            def windowsPushImages = '''
            powershell -NoProfile -Command "$ErrorActionPreference = 'Stop'; if ($env:DOCKER_REGISTRY) { $env:DOCKER_PASSWORD | & 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe' login $env:DOCKER_REGISTRY --username $env:DOCKER_USER --password-stdin } else { $env:DOCKER_PASSWORD | & 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe' login --username $env:DOCKER_USER --password-stdin }; & 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe' push $env:API_IMAGE; & 'C:\\Program Files\\Docker\\Docker\\resources\\bin\\docker.exe' push $env:WEB_IMAGE"
            '''.stripIndent().trim()

            runCommand(
              unixPushImages,
              windowsPushImages,
            )
          }
        }
      }
    }

    stage('Deploy') {
      when {
        expression { params.DEPLOY_WITH_COMPOSE }
      }
      steps {
        script {
          runCommand(
            composeCommand(env.DEPLOY_COMPOSE_PROJECT, 'up -d --build'),
            composeCommand(env.DEPLOY_COMPOSE_PROJECT, 'up -d --build'),
          )
        }
      }
    }
  }

  post {
    always {
      script {
        runCommand(
          "${composeCommand(env.CI_COMPOSE_PROJECT, 'down -v --remove-orphans')} || true",
          "${composeCommand(env.CI_COMPOSE_PROJECT, 'down -v --remove-orphans')} || exit /b 0",
        )
      }
    }
  }
}
