import crypto from "crypto";
import {
  createJWS,
  generateRandomString,
  getPrivateJWKforProvider,
  makeIat,
} from "./utils";
import { Configuration } from "./Configuration";
import { AuthenticationRequestEntity } from "./persistance/entity/AuthenticationRequestEntity";
import { dataSource } from "./persistance/data-source";

export function AuthenticationRequest(
  configuration: Configuration,
  {
    provider,
    scope = "openid",
    redirect_uri = configuration.redirect_uris[0],
    acr_values = "https://www.spid.gov.it/SpidL2", // TODO get from onboarding data
    prompt = "consent login",
    profile = "spid",
  }: {
    provider: string;
    scope?: string;
    redirect_uri?: string;
    acr_values?: string;
    prompt?: string;
    profile?: string;
  }
) {
  // TODO validate provider is a known provider
  // TODO validate scope parameter (should be space sperated list of supported scopes, must include openid)
  // TODO validate prompt inculdes supported values (space separated)
  // TODO validate redirect_uri is well formed

  // TODO get trust chain properly
  const trustChain = {
    sub: "http://127.0.0.1:8000/oidc/op/",
  };
  const authorization_endpoint = "http://127.0.0.1:8000/oidc/op/authorization"; // TODO
  const token_endpoint = "http://127.0.0.1:8000/oidc/op/token/"; // TODO
  const endpoint = authorization_endpoint;
  const nonce = generateRandomString(32); // TODO need to be saved somewhere?
  const state = generateRandomString(32);
  const { code_verifier, code_challenge, code_challenge_method } = getPKCE();
  const response_type = configuration.response_types[0];
  const client_id = configuration.client_id;
  const iat = makeIat();
  const aud = [trustChain.sub, authorization_endpoint];
  const claims = configuration.providers[profile].requestedClaims;
  const iss = client_id;
  const sub = client_id;
  const jwk = getPrivateJWKforProvider(configuration);
  async function asGetRequest() {
    const request = await createJWS(
      {
        scope,
        redirect_uri,
        response_type,
        nonce,
        state,
        client_id,
        endpoint,
        acr_values,
        iat,
        aud,
        claims,
        prompt,
        code_challenge,
        code_challenge_method,
        iss,
        sub,
      },
      jwk
    );
    const url = `${authorization_endpoint}?${new URLSearchParams({
      scope,
      redirect_uri,
      nonce,
      state,
      response_type,
      client_id,
      endpoint,
      acr_values,
      iat: iat.toString(),
      aud: JSON.stringify(aud),
      claims: JSON.stringify(claims),
      code_challenge,
      code_challenge_method,
      prompt,
      request,
    })}`;
    return { url };
  }
  async function asPostRequest() {
    // TODO implement
  }
  function asEntity() {
    return dataSource.getRepository(AuthenticationRequestEntity).create({
      state,
      redirect_uri,
      token_endpoint,
      code_verifier,
    });
  }

  return {
    asGetRequest,
    asPostRequest,
    asEntity,
  };
}

// TODO support more code challange methods
function getPKCE() {
  const REPLACEME_length = 64; // TODO read from config
  const code_verifier = generateRandomString(REPLACEME_length);
  const code_challenge_method = "S256"; // TODO read from config
  const code_challenge = crypto
    .createHash("sha256")
    .update(code_verifier)
    .digest("base64url");
  return {
    code_verifier,
    code_challenge,
    code_challenge_method,
  };
}
