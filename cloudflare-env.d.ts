declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    AZURACAST_BASE_URL?: string;
    AZURACAST_STATION_ID?: string;
    AZURACAST_API_KEY?: string;
  }
}
