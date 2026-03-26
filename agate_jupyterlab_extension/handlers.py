import json
import os

from jupyter_server.base.handlers import APIHandler
from jupyter_server.utils import url_path_join
import tornado
from tornado.httpclient import AsyncHTTPClient
from ._version import __version__
from .exceptions import (
    APIError,
    ValidationError,
    AuthenticationError,
    BadGatewayError,
    GatewayTimeoutError,
)

class RedirectingRouteHandler(APIHandler):
    @tornado.web.authenticated
    async def get(self):
        try:
            # Validate credentials
            domain = os.environ.get("AGATE_DOMAIN")
            token = os.environ.get("AGATE_TOKEN")

            if not domain or not token:
                raise AuthenticationError(
                    "Cannot connect to Onyx: JupyterLab environment does not have credentials"
                )

            # Validate route
            route = self.get_query_argument("route")

            if not route:
                raise ValidationError("Route is required")

            # Request for the Onyx API
            request = url_path_join(domain, route)

            # Usage of the AsyncHTTPClient is necessary to avoid blocking tornado event loop
            # https://www.tornadoweb.org/en/stable/guide/async.html
            client = AsyncHTTPClient()
            try:
                response = await client.fetch(
                    request,
                    raise_error=False,
                    headers={"Authorization": f"Token {token}"},
                )
            except ConnectionRefusedError:
                raise BadGatewayError("Failed to connect to Onyx: Connection refused")
            except TimeoutError:
                raise GatewayTimeoutError("Failed to connect to Onyx: Gateway timeout")
            else:
                self.finish(response.body)

        except APIError as e:
            self.set_status(e.STATUS_CODE)
            self.finish(json.dumps({"message": str(e)}))


class VersionHandler(APIHandler):
    @tornado.web.authenticated
    def get(self):
        try:
            # Return the version of the package
            self.finish(json.dumps({"version": __version__}))

        except APIError as e:
            self.set_status(e.STATUS_CODE)
            self.finish(json.dumps({"message": str(e)}))


def setup_handlers(web_app):
    host_pattern = ".*$"
    base_url = web_app.settings["base_url"]

    route_pattern = url_path_join(base_url, "agate-jupyterlab-extension", "reroute")
    handlers = [(route_pattern, RedirectingRouteHandler)]
    web_app.add_handlers(host_pattern, handlers)

    route_pattern = url_path_join(base_url, "agate-jupyterlab-extension", "version")
    handlers = [(route_pattern, VersionHandler)]
    web_app.add_handlers(host_pattern, handlers)
