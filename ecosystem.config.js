module.exports = {
    apps: [
        {
            name: 'avalon-wa',
            script: 'gateways/waWeb/app.js',
            instances: 1,
            autorestart: true,
            watch: false,
            max_memory_restart: '1G',
            wait_ready: true,
            listen_timeout: 10000,
            error_file: 'logs/avalon-waWeb-error.json',
            out_file: 'logs/avalon-waWeb-out.json',
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            merge_logs: true,
            log_type: 'json',
            max_size: '1M',
            rotate_logs: true,
            max_logs: 25,
            env: {
                NODE_ENV: 'development',
            },
            env_production: {
                NODE_ENV: 'production',
            },
        },
    ],
};