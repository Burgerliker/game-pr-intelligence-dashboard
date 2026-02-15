pipeline {
  agent any

  options {
    disableConcurrentBuilds()
    timestamps()
  }

  environment {
    APP_DIR = "${WORKSPACE}"
  }

  stages {
    stage('Checkout') {
      steps {
        checkout scm
      }
    }

    stage('Build Images') {
      steps {
        sh '''
          cd "$APP_DIR"
          docker compose build backend frontend
        '''
      }
    }

    stage('Deploy') {
      when {
        branch 'main'
      }
      steps {
        sh '''
          cd "$APP_DIR"
          docker compose up -d backend frontend
        '''
      }
    }

    stage('Health Check') {
      when {
        branch 'main'
      }
      steps {
        sh '''
          cd "$APP_DIR"
          for i in $(seq 1 30); do
            if curl -fsS http://localhost:8000/health >/dev/null; then
              break
            fi
            sleep 2
          done
          curl -fsS http://localhost:8000/health
          curl -fsSI http://localhost:3000 | head -n 1
        '''
      }
    }
  }

  post {
    failure {
      sh '''
        cd "$APP_DIR"
        docker compose ps || true
        docker compose logs --tail=80 backend frontend || true
      '''
    }
  }
}
