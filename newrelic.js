'use strict';

exports.config = {
  app_name: ['prode-api'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY,
  distributed_tracing: {
    enabled: true,
  },
  logging: {
    level: 'info',
  },
  application_logging: {
    forwarding: {
      enabled: true,
    },
  },
};
