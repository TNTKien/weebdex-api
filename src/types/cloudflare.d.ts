interface RequestInitCfProperties {
  cacheEverything?: boolean;
  cacheTtl?: number;
}

interface RequestInit {
  cf?: RequestInitCfProperties;
}
