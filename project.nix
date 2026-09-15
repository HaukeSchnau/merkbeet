let
  runtimeEnvironment = {
    MERKBEET_STATE_DIR = {
      binding = "data";
      field = "path";
    };
    MERKBEET_HOST = {
      endpoint = "web";
      field = "listen.host";
    };
    MERKBEET_PORT = {
      endpoint = "web";
      field = "listen.port";
    };
    MERKBEET_PASSCODE_FILE = {
      binding = "passcode";
      field = "file";
    };
  };
in
{
  project = {
    name = "merkbeet";
    requirements = {
      data = {
        kind = "directory";
        path = "data";
        persistent = true;
      };
      passcode.kind = "secret";
    };
    environment = runtimeEnvironment;
    releaseEnvironment.common = runtimeEnvironment;
    release = {
      health = {
        paths = [
          "/healthz"
          "/"
        ];
        startupTimeoutSec = 30;
        requestTimeoutSec = 10;
      };
      ingress = {
        compression = true;
        requestBodyMaxBytes = 12583936;
        responseHeaders.Strict-Transport-Security = "max-age=31536000; includeSubDomains";
      };
    };
  };
}
