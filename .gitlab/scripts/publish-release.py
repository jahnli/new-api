"""Upload tag-build assets to GitLab packages and attach them to a Release."""

import json
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import quote
from urllib.request import Request, urlopen


def gitlab_request(method, url, payload=None):
    headers = {"JOB-TOKEN": os.environ["CI_JOB_TOKEN"]}
    data = None
    if payload is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(payload).encode()
    request = Request(url, data=data, headers=headers, method=method)
    with urlopen(request, timeout=120) as response:
        return json.load(response)


def publish_release():
    tag = os.environ["CI_COMMIT_TAG"]
    project_url = f"{os.environ['CI_API_V4_URL']}/projects/{os.environ['CI_PROJECT_ID']}"
    release_url = f"{project_url}/releases/{quote(tag, safe='')}"
    package_name = "ai-gateway"
    if os.environ["TASK_TYPE"] == "electron-build":
        package_name = "ai-gateway-electron"
    # Each attempt gets its own package version, including retries of the same job.
    package_version = f"{os.environ['CI_PIPELINE_ID']}.{os.environ['CI_JOB_ID']}"
    package_url = f"{project_url}/packages/generic/{package_name}/{package_version}"
    files = sorted(path for path in Path("release-assets").iterdir() if path.is_file())
    if not files:
        raise RuntimeError("No release assets were downloaded")

    links = []
    for path in files:
        url = f"{package_url}/{quote(path.name, safe='')}"
        headers = {
            "JOB-TOKEN": os.environ["CI_JOB_TOKEN"],
            "Content-Type": "application/octet-stream",
            "Content-Length": str(path.stat().st_size),
        }
        with path.open("rb") as data:
            request = Request(url, data=data, headers=headers, method="PUT")
            with urlopen(request, timeout=600) as response:
                if response.status != 201:
                    raise RuntimeError(f"Package upload returned HTTP {response.status}")
        links.append({"name": path.name, "url": url, "link_type": "package"})
        print(f"Uploaded: {path.name}", flush=True)

    try:
        release = gitlab_request("GET", release_url)
    except HTTPError as error:
        if error.code != 404:
            raise
        gitlab_request(
            "POST",
            f"{project_url}/releases",
            {
                "tag_name": tag,
                "name": tag,
                "description": f"Build artifacts for {tag}.",
                "assets": {"links": links},
            },
        )
    else:
        # Preserve release notes and assets from other task types on the same tag.
        existing = {link["name"]: link for link in release["assets"]["links"]}
        for link in links:
            previous = existing.get(link["name"])
            if previous is None:
                gitlab_request("POST", f"{release_url}/assets/links", link)
            else:
                gitlab_request("PUT", f"{release_url}/assets/links/{previous['id']}", link)
    print(f"Published GitLab Release: {tag}")


if __name__ == "__main__":
    try:
        publish_release()
    except HTTPError as error:
        # Report status without dumping request headers or response bodies.
        raise SystemExit(f"GitLab publication failed: HTTP {error.code}") from None
