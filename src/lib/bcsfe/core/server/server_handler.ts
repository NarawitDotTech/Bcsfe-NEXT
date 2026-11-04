/** Port of bcsfe/core/server/server_handler.py (all methods async, HTTP via CORS proxy) */
import { Data, base64ToBytes } from "@/lib/bcsfe/core/io/data";
import { SaveFile } from "@/lib/bcsfe/core/io/save";
import type { CountryCode } from "@/lib/bcsfe/core/country_code";
import type { GameVersion } from "@/lib/bcsfe/core/game_version";
import { core_data } from "@/lib/bcsfe/core/core_data";
import { Random } from "@/lib/bcsfe/core/crypto";
import { AccountHeaders } from "@/lib/bcsfe/core/server/headers";
import { ClientInfo } from "@/lib/bcsfe/core/server/client_info";
import { BackupMetaData } from "@/lib/bcsfe/core/server/managed_item";
import {
  MultipartForm,
  RequestHandler,
  json_dumps_nospace,
} from "@/lib/bcsfe/core/server/request";

type Json = Record<string, unknown>;

const UA = "Dalvik/2.1.0 (Linux; U; Android 9; SM-G955F Build/N2G48B)";

function now_s(): number {
  return Date.now() / 1000;
}

async function response_json(response: Response): Promise<Json> {
  try {
    const v: unknown = await response.json();
    if (v !== null && typeof v === "object" && !Array.isArray(v)) return v as Json;
    return {};
  } catch {
    return {};
  }
}

export class RequestResult {
  url: string;
  response: Response | null;
  headers: Record<string, string>;
  data: string;
  payload: Json | null;
  timestamp: string | null;
  /** Extra (not in Python): response body text if it was read for logging. */
  response_text: string | null = null;

  constructor(
    url: string,
    response: Response | null,
    headers: Record<string, string>,
    data: string,
    payload: Json | null = null,
    timestamp: string | null = null,
  ) {
    this.url = url;
    this.response = response;
    this.headers = headers;
    this.data = data;
    this.payload = payload;
    this.timestamp = timestamp;
  }
}

/** Progress / status callback replacing the Python `print_key` console output. */
export type StatusCallback = (key: string, kwargs?: Record<string, unknown>) => void;

export class ServerHandler {
  static auth_url = "https://nyanko-auth.ponosgames.com";
  static save_url = "https://nyanko-save.ponosgames.com";
  static backups_url = "https://nyanko-backups.ponosgames.com";
  static aws_url = "https://nyanko-service-data-prd.s3.amazonaws.com";
  static managed_item_url = "https://nyanko-managed-item.ponosgames.com";
  static events_url = "https://nyanko-events.ponosgames.com";

  save_file: SaveFile;
  print: boolean;
  counter = 0;
  /** Replaces console printing: called with locale keys (e.g. "getting_password"). */
  on_status: StatusCallback | null;
  /** Set by from_codes: raw bytes of the downloaded save (transfer backup). */
  transfer_backup: Uint8Array | null = null;

  constructor(save_file: SaveFile, print: boolean = true, on_status: StatusCallback | null = null) {
    this.save_file = save_file;
    this.print = print;
    this.on_status = on_status;
  }

  get auth_url(): string {
    return ServerHandler.auth_url;
  }
  get save_url(): string {
    return ServerHandler.save_url;
  }
  get backups_url(): string {
    return ServerHandler.backups_url;
  }
  get aws_url(): string {
    return ServerHandler.aws_url;
  }
  get managed_item_url(): string {
    return ServerHandler.managed_item_url;
  }
  get events_url(): string {
    return ServerHandler.events_url;
  }

  static get_password_key(): string {
    return "password";
  }
  static get_auth_token_key(): string {
    return "auth_token";
  }
  static get_save_key_key(): string {
    return "save_key";
  }

  save_password(password: string): void {
    this.save_file.store_string(ServerHandler.get_password_key(), password);
  }
  get_stored_password(): string | null {
    return this.save_file.get_string(ServerHandler.get_password_key());
  }
  remove_stored_password(): void {
    this.save_file.remove_string(ServerHandler.get_password_key());
  }

  save_save_key_data(save_key: Record<string, string>): void {
    this.save_file.store_dict(ServerHandler.get_save_key_key(), save_key);
  }

  get_stored_save_key_data(): Record<string, string> | null {
    const save_key_data = this.save_file.get_dict(ServerHandler.get_save_key_key());
    if (save_key_data === null || save_key_data === undefined) return null;
    if (!this.validate_save_key_data(save_key_data)) {
      this.remove_stored_save_key_data();
      return null;
    }
    return save_key_data;
  }

  validate_save_key_data(save_key_data: Record<string, string>): boolean {
    try {
      const key = save_key_data["key"];
      if (key === undefined || key === null) return false;
      if (key.split("/")[2] !== this.save_file.inquiry_code) return false;
      const policy_b64 = save_key_data["policy"];
      if (policy_b64 === undefined || policy_b64 === null) return false;
      const json_policy = JSON.parse(new TextDecoder().decode(base64ToBytes(policy_b64))) as Json;
      const expiration = json_policy["expiration"];
      if (typeof expiration !== "string") return false;
      const ms = Date.parse(expiration);
      if (Number.isNaN(ms)) return false;
      if (Math.floor(ms / 1000) < now_s()) return false;
      return true;
    } catch {
      return false;
    }
  }

  remove_stored_save_key_data(): void {
    this.save_file.remove_dict(ServerHandler.get_save_key_key());
  }

  save_auth_token(auth_token: string): void {
    this.save_file.store_string(ServerHandler.get_auth_token_key(), auth_token);
  }
  get_stored_auth_token(): string | null {
    return this.save_file.get_string(ServerHandler.get_auth_token_key());
  }
  remove_stored_auth_token(): void {
    this.save_file.remove_string(ServerHandler.get_auth_token_key());
  }

  async get_password_new(): Promise<string | null> {
    this.print_key("getting_password");
    const url = `${this.auth_url}/v1/users`;
    const data = {
      accountCode: this.save_file.inquiry_code,
      accountCreatedAt: Math.trunc(Number(this.save_file.energy_penalty_timestamp)),
      nonce: Random.get_hex_string(32),
    };
    return this.do_password_request(url, data);
  }

  static async log_error(key: string, result: RequestResult): Promise<void> {
    if (result.data.includes("EXPECT_THIS_TO_FAIL")) return;
    if (result.response === null) {
      core_data.logger.log_error("Failed to make request. Check your internet connection.");
      return;
    }
    let body = "";
    try {
      body = await result.response.clone().text();
    } catch {
      /* ignore */
    }
    const resp_headers: Record<string, string> = {};
    result.response.headers.forEach((v, k) => {
      resp_headers[k] = v;
    });
    const log_text =
      `Error: ${key}\n` +
      `URL: ${result.url}\n` +
      `Response Headers: ${JSON.stringify(resp_headers)}\n` +
      `Response Body: ${body}\n` +
      `Status Code: ${result.response.status}\n` +
      `Reason: ${result.response.statusText}\n` +
      `Request Headers: ${JSON.stringify(result.headers)}\n` +
      `Request Body: ${result.data}\n`;
    core_data.logger.log_error(log_text);
  }

  async do_password_request(url: string, dict_data: Json): Promise<string | null> {
    const result = await this.do_request(url, dict_data);
    if (result.payload === null) {
      await ServerHandler.log_error("password_fail", result);
      return null;
    }
    const payload = result.payload;
    const password = payload["password"];
    if (typeof password !== "string") {
      await ServerHandler.log_error("password_fail", result);
      this.remove_stored_password();
      return null;
    }
    const password_refresh_token = payload["passwordRefreshToken"];
    if (typeof password_refresh_token !== "string") {
      await ServerHandler.log_error("password_fail", result);
      this.remove_stored_password();
      return null;
    }
    const account_code = payload["accountCode"];
    const timestamp = result.timestamp;

    this.save_file.password_refresh_token = password_refresh_token;
    this.save_password(password);
    if (account_code) {
      this.save_file.inquiry_code = String(account_code);
      this.remove_stored_auth_token();
      this.remove_stored_save_key_data();

      if (timestamp !== null && timestamp !== undefined) {
        this.save_file.energy_penalty_timestamp = Math.trunc(Number(timestamp));
      }
      if (!(await this.update_managed_items())) return null;
    }
    return password;
  }

  async do_request(url: string, dict_data: Json): Promise<RequestResult> {
    const data = json_dumps_nospace(dict_data);
    const headers = new AccountHeaders(this.save_file, data).get_headers();
    const response = await new RequestHandler(url, headers, new Data(data)).post();
    if (response === null) {
      await this.log_no_internet(new RequestResult(url, null, headers, data));
      return new RequestResult(url, response, headers, data);
    }
    const json = await response_json(response);
    const status_code = json["statusCode"] ?? 0;
    if (status_code !== 1) return new RequestResult(url, response, headers, data);

    const ts = json["timestamp"];
    const timestamp = ts === undefined || ts === null ? null : String(ts);
    const payload = (json["payload"] ?? {}) as Json;
    return new RequestResult(url, response, headers, data, payload, timestamp);
  }

  async refresh_password(): Promise<string | null> {
    this.print_key("refreshing_password");
    const url = `${this.auth_url}/v1/user/password`;
    const data = {
      accountCode: this.save_file.inquiry_code,
      passwordRefreshToken: this.save_file.password_refresh_token,
      nonce: Random.get_hex_string(32),
    };
    return this.do_password_request(url, data);
  }

  async get_auth_token_new(password: string): Promise<string | null> {
    this.print_key("getting_auth_token");
    const url = `${this.auth_url}/v1/tokens`;
    const data = ClientInfo.from_save_file(this.save_file).get_client_info();
    data["password"] = password;
    data["accountCode"] = this.save_file.inquiry_code;

    const result = await this.do_request(url, data);
    if (result.payload === null) {
      await ServerHandler.log_error("auth_token_fail", result);
      this.remove_stored_auth_token();
      this.remove_stored_password();
      return null;
    }
    const auth_token = result.payload["token"];
    if (typeof auth_token !== "string") {
      await ServerHandler.log_error("auth_token_fail", result);
      this.remove_stored_auth_token();
      this.remove_stored_password();
      return null;
    }
    this.save_auth_token(auth_token);
    return auth_token;
  }

  async get_password(tries: number = 0): Promise<string | null> {
    let password = this.get_stored_password();
    if (password !== null && password !== undefined) return password;
    password = await this.refresh_password();
    if (password !== null) return password;
    password = await this.get_password_new();
    if (password !== null) return password;
    await this.create_new_account();
    if (tries >= 1) return null;
    return this.get_password(tries + 1);
  }

  validate_auth_token(auth_token: string): boolean {
    try {
      const part = auth_token.split(".")[1];
      if (!part) return false;
      let b64 = part.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const token = JSON.parse(new TextDecoder().decode(base64ToBytes(b64))) as Json;
      if (!token) return false;
      const exp = token["exp"];
      if ((typeof exp === "number" ? exp : 0) < now_s()) return false;
      if ((token["accountCode"] ?? null) !== this.save_file.inquiry_code) return false;
      return true;
    } catch {
      return false;
    }
  }

  async get_auth_token(tries: number = 1): Promise<string | null> {
    let auth_token = this.get_stored_auth_token();
    if (auth_token !== null && auth_token !== undefined) {
      if (this.validate_auth_token(auth_token)) return auth_token;
      this.remove_stored_auth_token();
    }
    const password = await this.get_password();
    if (password === null) return null;
    auth_token = this.get_stored_auth_token();
    if (auth_token !== null && auth_token !== undefined) return auth_token;
    auth_token = await this.get_auth_token_new(password);
    if (auth_token !== null) return auth_token;

    if (tries > 0) {
      this.print_key("retry_auth_token");
      return this.get_auth_token(tries - 1);
    }
    return null;
  }

  async log_no_internet(result: RequestResult): Promise<void> {
    await ServerHandler.log_error("no_internet", result);
    if (this.print) this.print_key("no_internet");
  }

  async get_save_key_new(auth_token: string): Promise<Record<string, string> | null> {
    this.print_key("getting_save_key");
    const nonce = Random.get_hex_string(32);
    const url = `${this.save_url}/v2/save/key?nonce=${nonce}`;
    const headers: Record<string, string> = {
      "accept-encoding": "gzip",
      connection: "keep-alive",
      authorization: "Bearer " + auth_token,
      "nyanko-timestamp": String(Math.floor(now_s())),
      "user-agent": UA,
    };
    const response = await new RequestHandler(url, headers).get();
    if (response === null) {
      await this.log_no_internet(new RequestResult(url, null, headers, ""));
      return null;
    }
    const json = await response_json(response);
    if ((json["statusCode"] ?? 0) !== 1) {
      await ServerHandler.log_error("save_key_fail", new RequestResult(url, response, headers, ""));
      this.remove_stored_auth_token();
      return null;
    }
    const payload = (json["payload"] ?? {}) as Record<string, string>;
    this.save_save_key_data(payload);
    return payload;
  }

  async get_save_key(): Promise<Record<string, string> | null> {
    const auth_token = await this.get_auth_token();
    if (auth_token === null) return null;
    return this.get_save_key_new(auth_token);
  }

  get_upload_request_form(save_key: Record<string, string>): MultipartForm {
    const save_data = this.save_file.to_data();
    const form_data = new MultipartForm();
    const enc = new TextEncoder();
    for (const [key, value] of Object.entries(save_key)) {
      if (key === "url") continue;
      form_data.add_key(key, enc.encode(value), "text/plain");
    }
    form_data.add_key("file", save_data.to_bytes(), "application/octet-stream", "file.sav");
    return form_data;
  }

  async upload_save_data(save_key: Record<string, string>): Promise<boolean> {
    this.print_key("uploading_save_file");
    const form = this.get_upload_request_form(save_key);
    const url = save_key["url"] ?? `${this.aws_url}/`;
    const headers: Record<string, string> = {
      "accept-encoding": "gzip",
      connection: "keep-alive",
      "user-agent": UA,
    };
    const response = await new RequestHandler(url, headers, null, form).post(true);
    if (response === null) {
      await this.log_no_internet(new RequestResult(url, null, headers, ""));
      return false;
    }
    if (response.status !== 204) {
      await ServerHandler.log_error(
        "upload_fail_aws",
        new RequestResult(url, response, headers, form.get_all_type("text-plain")),
      );
      this.remove_stored_save_key_data();
      return false;
    }
    return true;
  }

  print_key(key: string, kwargs?: Record<string, unknown>): void {
    if (this.print && this.on_status) this.on_status(key, kwargs);
  }

  async get_codes(
    upload_managed_items: boolean = true,
    tries: number = 3,
  ): Promise<[string, string] | null> {
    if (tries === 0) return null;
    tries -= 1;
    this.save_file.show_ban_message = false;

    const auth_token = await this.get_auth_token();
    if (auth_token === null) return this.get_codes(upload_managed_items, tries);

    const save_key = await this.get_save_key();
    if (save_key === null) {
      this.remove_stored_save_key_data();
      return this.get_codes(upload_managed_items, tries);
    }

    if (!(await this.upload_save_data(save_key))) {
      return this.get_codes(upload_managed_items, tries);
    }

    this.print_key("getting_codes");

    const bmd = new BackupMetaData(this.save_file);
    const meta_data = bmd.create(save_key["key"], upload_managed_items);

    const url = `${this.save_url}/v2/transfers`;
    const headers = new AccountHeaders(this.save_file, meta_data).get_headers();
    headers["authorization"] = "Bearer " + auth_token;

    const response = await new RequestHandler(url, headers, new Data(meta_data)).post();
    if (response === null) {
      await this.log_no_internet(new RequestResult(url, null, headers, meta_data));
      return null;
    }
    const json = await response_json(response);
    if ((json["statusCode"] ?? 0) !== 1) {
      await ServerHandler.log_error(
        "upload_fail_transfers",
        new RequestResult(url, response, headers, meta_data),
      );
      this.remove_stored_auth_token();
      return this.get_codes(upload_managed_items, tries);
    }
    const payload = (json["payload"] ?? {}) as Json;
    const transfer_code = payload["transferCode"];
    const confirmation_code = payload["pin"];
    if (
      transfer_code === undefined ||
      transfer_code === null ||
      confirmation_code === undefined ||
      confirmation_code === null
    ) {
      await ServerHandler.log_error(
        "upload_fail_transfers",
        new RequestResult(url, response, headers, ""),
      );
      this.remove_stored_auth_token();
      return this.get_codes(upload_managed_items, tries);
    }
    bmd.remove_managed_items();
    return [String(transfer_code), String(confirmation_code)];
  }

  has_managed_items(): boolean {
    return new BackupMetaData(this.save_file).get_managed_items().length !== 0;
  }

  async upload_meta_data(): Promise<boolean> {
    const auth_token = await this.get_auth_token();
    if (auth_token === null) return false;

    const save_key = await this.get_save_key();
    if (save_key === null) {
      this.remove_stored_save_key_data();
      return false;
    }

    if (!(await this.upload_save_data(save_key))) return false;

    const bmd = new BackupMetaData(this.save_file);
    const meta_data = bmd.create(save_key["key"]);

    const url = `${this.save_url}/v2/backups`;
    const headers = new AccountHeaders(this.save_file, meta_data).get_headers();
    headers["authorization"] = "Bearer " + auth_token;

    const response = await new RequestHandler(url, headers, new Data(meta_data)).post();
    if (response === null) {
      await this.log_no_internet(new RequestResult(url, null, headers, meta_data));
      return false;
    }
    const json = await response_json(response);
    if ((json["statusCode"] ?? 0) !== 1) {
      this.remove_stored_auth_token();
      return false;
    }
    bmd.remove_managed_items();
    return true;
  }

  async get_new_inquiry_code(): Promise<string | null> {
    const url = `${this.backups_url}/?action=createAccount&referenceId=`;
    const response = await new RequestHandler(url).get();
    if (response === null) {
      await this.log_no_internet(new RequestResult(url, null, {}, ""));
      return null;
    }
    const data = await response_json(response);
    const iq = data["accountId"];
    if (typeof iq !== "string") return null;
    return iq;
  }

  async create_new_account(tries: number = 3): Promise<boolean> {
    if (tries === 0) return false;
    tries -= 1;
    const new_iq = await this.get_new_inquiry_code();
    if (new_iq === null) return this.create_new_account(tries);
    this.save_file.inquiry_code = new_iq;
    this.remove_stored_auth_token();
    this.remove_stored_save_key_data();
    this.remove_stored_password();
    const fail_text = "EXPECT_THIS_TO_FAIL";
    const start_count = Math.floor((40 - fail_text.length) / 2);
    const end_count = 40 - fail_text.length - start_count;
    this.save_file.password_refresh_token = "_".repeat(start_count) + fail_text + "_".repeat(end_count);
    const password = await this.get_password();
    const auth_token = await this.get_auth_token();
    const save_key_data = await this.get_save_key();
    await this.update_managed_items();
    this.save_file.show_ban_message = false;
    if (password === null || auth_token === null || save_key_data === null) {
      return this.create_new_account(tries);
    }
    return true;
  }

  /**
   * Download a save from transfer + confirmation code.
   * Returns [handler | null, result | null] exactly like Python:
   *  - [null, null]: no internet / request failed
   *  - [null, result]: invalid codes (non octet-stream response)
   *  - [handler, result]: success (handler.save_file is the downloaded save,
   *    handler.transfer_backup holds the raw bytes).
   */
  static async from_codes(
    transfer_code: string,
    confirmation_code: string,
    cc: CountryCode,
    gv: GameVersion,
    print: boolean = true,
    _save_backup: boolean = true,
    on_status: StatusCallback | null = null,
  ): Promise<[ServerHandler | null, RequestResult | null]> {
    const url = `${ServerHandler.save_url}/v2/transfers/${transfer_code}/reception`;
    const data = new ClientInfo(cc, gv).get_client_info();
    data["pin"] = confirmation_code;
    const data_str = json_dumps_nospace(data);

    const headers: Record<string, string> = {
      "content-type": "application/json",
      "accept-encoding": "gzip",
      connection: "keep-alive",
      "user-agent": UA,
    };
    const response = await new RequestHandler(url, headers, new Data(data_str)).post();
    if (response === null) {
      if (print && on_status) on_status("no_internet");
      return [null, null];
    }
    const content_type = response.headers.get("content-type") ?? "";
    if (content_type !== "application/octet-stream") {
      return [null, new RequestResult(url, response, headers, data_str)];
    }

    const save_data = new Uint8Array(await response.arrayBuffer());

    const save_file = new SaveFile(new Data(save_data), cc);

    const password_refresh_token = response.headers.get("Nyanko-Password-Refresh-Token");
    if (password_refresh_token !== null) {
      save_file.password_refresh_token = password_refresh_token;
    }

    const server_handler = new ServerHandler(save_file, true, on_status);
    server_handler.transfer_backup = save_data;
    const password = response.headers.get("Nyanko-Password");
    if (password !== null) server_handler.save_password(password);

    return [server_handler, new RequestResult(url, response, headers, data_str)];
  }

  async update_managed_items(): Promise<boolean> {
    const auth_token = await this.get_auth_token();
    if (auth_token === null) return false;
    const data = {
      catfoodAmount: this.save_file.catfood,
      isPaid: true,
      legendTicketAmount: this.save_file.legend_tickets,
      nonce: Random.get_hex_string(32),
      platinumTicketAmount: this.save_file.platinum_tickets,
      rareTicketAmount: this.save_file.rare_tickets,
    };
    const data_str = json_dumps_nospace(data);
    const url = `${this.managed_item_url}/v1/managed-items`;
    const headers = new AccountHeaders(this.save_file, data_str).get_headers();
    headers["authorization"] = "Bearer " + auth_token;
    const response = await new RequestHandler(url, headers, new Data(data_str)).post();
    if (response === null) {
      await this.log_no_internet(new RequestResult(url, null, headers, data_str));
      return false;
    }
    const json = await response_json(response);
    if ((json["statusCode"] ?? 0) !== 1) {
      this.remove_stored_auth_token();
      return false;
    }
    new BackupMetaData(this.save_file).remove_managed_items();
    return true;
  }

  async download_event_data(filename: string): Promise<Data | null> {
    let url =
      this.events_url + `/battlecats${this.save_file.cc.get_patching_code()}_production/${filename}`;
    const auth_token = await this.get_auth_token();
    if (auth_token === null) return null;
    url += `?jwt=${auth_token}`;
    const headers: Record<string, string> = {
      "accept-encoding": "gzip",
      connection: "keep-alive",
      "user-agent": "Dalvik/2.1.0 (Linux; U; Android 9; Pixel 2 Build/PQ3A.190801.002)",
    };
    const resp = await new RequestHandler(url, headers).get();
    if (resp === null) return null;
    return new Data(new Uint8Array(await resp.arrayBuffer()));
  }

  async download_gatya_data(): Promise<Data | null> {
    return this.download_event_data("gatya.tsv");
  }
  async download_item_data(): Promise<Data | null> {
    return this.download_event_data("item.tsv");
  }
  async download_sale_data(): Promise<Data | null> {
    return this.download_event_data("sale.tsv");
  }
}
