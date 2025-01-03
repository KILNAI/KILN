import random

import requests

import app.desktop.desktop_server as desktop_server


def test_desktop_app_server():
    # random port between 9000 and 12000
    port = random.randint(9000, 12000)
    config = desktop_server.server_config(port=port)
    uni_server = desktop_server.ThreadedServer(config=config)
    with uni_server.run_in_thread():
        r = requests.get("http://127.0.0.1:{}/ping".format(port))
        assert r.status_code == 200
