pipeline {
    agent any

    options {
        disableConcurrentBuilds()
        timeout(time: 20, unit: 'MINUTES')
    }

    stages {
        stage('Install') {
            steps {
                sh '''
                set -e
                echo "--- Installing dependencies (npm ci) ---"
                npm ci --no-audit --no-fund
                '''
            }
        }

        stage('Compile') {
            steps {
                sh '''
                set -e
                # Fails on any Solidity compile error or warning promoted by the config
                npx hardhat compile
                '''
            }
        }

        stage('Test') {
            steps {
                sh '''
                set -e
                # Unit tests on the in-process Hardhat network (no RPC, no keys needed)
                npx hardhat test
                '''
            }
        }

        stage('Coverage') {
            steps {
                sh '''
                set -e
                npx hardhat coverage
                '''
            }
            post {
                always {
                    archiveArtifacts artifacts: 'coverage/**, coverage.json', allowEmptyArchive: true
                }
            }
        }

        stage('Audit') {
            steps {
                sh '''
                # Warn-only: hardhat-toolbox pulls dev-only advisories that cannot be fixed without
                # a major upgrade; nothing here ships to users.
                npm audit --audit-level=critical || echo "WARNING: npm audit reported critical advisories (not failing the build)"
                '''
            }
        }
    }
}
