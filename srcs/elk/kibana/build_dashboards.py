#!/usr/bin/env python3
"""Generate srcs/elk/kibana/dashboard.ndjson — the Kibana saved objects elk-setup imports.

Kibana's saved-object format for Lens panels is deeply nested JSON-in-JSON and unreadable
by hand, so the dashboards are described here and serialised. Edit this file, then:

    python3 srcs/elk/kibana/build_dashboards.py      # rewrites dashboard.ndjson
    make elk                                          # re-imports (overwrite=true)

Stdlib only. Log panels query the normalised fields the Logstash pipeline writes
(srcs/elk/logstash/pipeline.conf, header comment) — not the raw per-service ones. The Service
Status dashboard reads Heartbeat's own ECS fields (monitor.*, summary.*) from heartbeat-*.
Targets Kibana 8.17; the migration versions below are what that release stamps.
"""
import json
from pathlib import Path

DATA_VIEW = "smartbreeds-logs-dataview"
UPTIME_VIEW = "smartbreeds-heartbeat-dataview"  # heartbeat-*, created by elk-setup
OUT = Path(__file__).with_name("dashboard.ndjson")

# Reserved status colours: a level or status class always wears the same one, on every panel.
GOOD, WARN, SERIOUS, CRITICAL, NEUTRAL = "#0ca30c", "#fab219", "#ec835a", "#d03b3b", "#8f97a3"

# The same request is logged once per layer it crosses (nginx, gateway, backend), so each
# HTTP panel pins exactly one layer. Healthcheck probes are noise everywhere.
EDGE = "http.layer:edge and not healthcheck:true"
GATEWAY = "http.layer:gateway and not healthcheck:true"
VISION = 'http.layer:gateway and url.path:"/api/v1/vision/analyze"'
LOGIN = 'url.path:("/api/v1/auth/login" or "/api/v1/auth/login/2fa")'
PROBLEMS = "level:(WARNING or ERROR or CRITICAL)"
MS = {"id": "number", "params": {"decimals": 0, "suffix": " ms"}}


# --- Lens column builders -------------------------------------------------------
def count(label, kql=None):
    col = {"label": label, "customLabel": True, "dataType": "number", "operationType": "count",
           "isBucketed": False, "scale": "ratio", "sourceField": "___records___",
           "params": {"emptyAsNull": False}}
    if kql:
        col["filter"] = {"query": kql, "language": "kuery"}
    return col


def metric(op, field, label, fmt=None, kql=None, **params):
    col = {"label": label, "customLabel": True, "dataType": "number", "operationType": op,
           "isBucketed": False, "scale": "ratio", "sourceField": field, "params": dict(params)}
    if fmt:
        col["params"]["format"] = fmt
    if kql:
        col["filter"] = {"query": kql, "language": "kuery"}
    return col


def date():
    return {"label": "@timestamp", "dataType": "date", "operationType": "date_histogram",
            "sourceField": "@timestamp", "isBucketed": True, "scale": "interval",
            "params": {"interval": "auto", "includeEmptyRows": True, "dropPartials": False}}


def terms(field, label, order_by, size=10, other=True, data_type="string"):
    return {"label": label, "customLabel": True, "dataType": data_type, "operationType": "terms",
            "sourceField": field, "isBucketed": True, "scale": "ordinal",
            "params": {"size": size, "orderBy": {"type": "column", "columnId": order_by},
                       "orderDirection": "desc", "otherBucket": other, "missingBucket": False,
                       "parentFormat": {"id": "terms"}, "include": [], "exclude": [],
                       "includeIsRegex": False, "excludeIsRegex": False}}


def last_value(field, label):
    return {"label": label, "customLabel": True, "dataType": "string",
            "operationType": "last_value", "isBucketed": False, "scale": "ordinal",
            "sourceField": field, "params": {"sortField": "@timestamp", "showArrayValues": False}}


# --- Lens visualisations (one layer each) ----------------------------------------
LAYER = "layer1"


def lens(title, vis_type, visualization, columns, kql=""):
    """columns: ordered {column_id: column}; bucket columns must precede metrics."""
    return {
        "title": title,
        "description": "",
        "visualizationType": vis_type,
        "state": {
            "visualization": visualization,
            "query": {"query": kql, "language": "kuery"},
            "filters": [],
            "datasourceStates": {"formBased": {"layers": {LAYER: {
                "columns": columns, "columnOrder": list(columns), "incompleteColumns": {},
                "sampling": 1}}}},
            "internalReferences": [],
            "adHocDataViews": {},
        },
    }


def stat(title, col, kql=""):
    # No static background colour: a tile painted red reads as an alarm even when it shows 0.
    vis = {"layerId": LAYER, "layerType": "data", "metricAccessor": "m"}
    return lens(title, "lnsMetric", vis, {"m": {**col, "label": title, "customLabel": True}}, kql)


def xy(title, series, columns, x="x", split=None, accessors=None, colors=None, kql="",
       legend="right", y_title=None):
    accessors = accessors or [c for c in columns if c not in (x, split)]
    layer = {"layerId": LAYER, "layerType": "data", "seriesType": series, "xAccessor": x,
             "accessors": accessors, "position": "top", "showGridlines": False}
    if split:
        layer["splitAccessor"] = split
    if colors:
        layer["yConfig"] = [{"forAccessor": a, "color": c} for a, c in colors.items()]
    vis = {"legend": {"isVisible": legend != "hide", "position": "right" if legend == "hide" else legend},
           "valueLabels": "hide", "preferredSeriesType": series, "fittingFunction": "Linear",
           "curveType": "LINEAR", "layers": [layer]}
    if y_title:
        # Without it Lens titles the axis after the first series ("2xx", "p50", ...).
        vis["yTitle"] = y_title
    return lens(title, "lnsXY", vis, columns, kql)


def over_time(title, series_cols, kql="", colors=None, series="bar_stacked", y_title="Events"):
    return xy(title, series, {"x": date(), **series_cols}, colors=colors, kql=kql,
              y_title=y_title)


def by_term(title, field, label, metric_col, kql="", size=10):
    """Horizontal bar ranking the top values of `field`."""
    cols = {"x": terms(field, label, "m", size=size, other=False), "m": metric_col}
    return xy(title, "bar_horizontal", cols, kql=kql, legend="hide")


def donut(title, field, label, kql="", size=10, data_type="string"):
    cols = {"g": terms(field, label, "m", size=size, data_type=data_type), "m": count("Events")}
    vis = {"shape": "donut", "layers": [{
        "layerId": LAYER, "layerType": "data", "primaryGroups": ["g"], "metrics": ["m"],
        "numberDisplay": "percent", "categoryDisplay": "default", "legendDisplay": "show",
        "nestedLegend": False}]}
    return lens(title, "lnsPie", vis, cols, kql)


def table(title, columns, kql=""):
    vis = {"layerId": LAYER, "layerType": "data",
           "columns": [{"columnId": c, "isTransposed": False} for c in columns]}
    return lens(title, "lnsDatatable", vis, columns, kql)


def levels_over_time(title, kql=""):
    return over_time(title, {
        "info": count("INFO", "level:(INFO or DEBUG)"),
        "warning": count("WARNING", "level:WARNING"),
        "error": count("ERROR", "level:ERROR"),
        "critical": count("CRITICAL", "level:CRITICAL"),
    }, kql, {"info": NEUTRAL, "warning": WARN, "error": SERIOUS, "critical": CRITICAL})


def status_over_time(title, kql):
    return over_time(title, {
        "s2": count("2xx", "http.status_class:2xx"),
        "s3": count("3xx", "http.status_class:3xx"),
        "s4": count("4xx", "http.status_class:4xx"),
        "s5": count("5xx", "http.status_class:5xx"),
    }, kql, {"s2": GOOD, "s3": NEUTRAL, "s4": WARN, "s5": CRITICAL}, y_title="Requests")


def latency_over_time(title, kql):
    return over_time(title, {
        "p50": metric("median", "http.duration_ms", "p50", MS),
        "p95": metric("percentile", "http.duration_ms", "p95", MS, percentile=95),
        "p99": metric("percentile", "http.duration_ms", "p99", MS, percentile=99),
    }, kql, series="line", y_title="Latency (ms)")


# --- Saved searches (Discover + embedded in dashboards) -----------------------------
def search(id_, title, description, kql, columns):
    source = {"query": {"query": kql, "language": "kuery"}, "filter": [],
              "sort": [["@timestamp", "desc"]],
              "indexRefName": "kibanaSavedObjectMeta.searchSourceJSON.index"}
    return {"id": id_, "type": "search", "coreMigrationVersion": "8.8.0",
            "typeMigrationVersion": "10.5.0",
            "references": [{"id": DATA_VIEW, "type": "index-pattern",
                            "name": "kibanaSavedObjectMeta.searchSourceJSON.index"}],
            "attributes": {"title": title, "description": description, "columns": columns,
                           "sort": [["@timestamp", "desc"]],
                           "kibanaSavedObjectMeta": {"searchSourceJSON": json.dumps(source)}}}


SEARCHES = [
    search("smartbreeds-all-logs-search", "All Logs",
           "Every ingested SmartBreeds log line, newest first.",
           "", ["service", "level", "message"]),
    search("smartbreeds-problems-search", "Errors & Warnings",
           "WARNING, ERROR and CRITICAL lines from every service.",
           PROBLEMS, ["service", "level", "message"]),
    search("smartbreeds-security-search", "Security Events",
           "Rejected requests at the edge (401/403/429) and CRITICAL lines (e.g. failed DB auth).",
           "(http.layer:edge and http.status:(401 or 403 or 429)) or level:CRITICAL",
           ["client.ip", "http.method", "url.path", "http.status", "message"]),
    search("smartbreeds-ai-problems-search", "AI Pipeline Problems",
           "Warnings and errors from ai-service, classification-service and the LiteLLM proxy.",
           f"service:(ai-service or classification-service or litellm) and {PROBLEMS}",
           ["service", "level", "message"]),
]


# --- Dashboards ------------------------------------------------------------------
class Dashboard:
    """Lays panels out on Kibana's 48-column grid, left to right, wrapping rows."""

    def __init__(self, id_, title, description, controls, data_view=DATA_VIEW, time_from="now-4h"):
        self.id, self.title, self.description, self.controls = id_, title, description, controls
        self.data_view, self.time_from = data_view, time_from
        self.panels, self.references, self.visualizations = [], [], []
        self.x = self.y = self.row_h = 0

    def _place(self, w, h):
        if self.x + w > 48:
            self.x, self.y, self.row_h = 0, self.y + self.row_h, 0
        grid = {"x": self.x, "y": self.y, "w": w, "h": h}
        self.x += w
        self.row_h = max(self.row_h, h)
        return grid

    def _by_reference(self, obj_type, obj_id, w, h):
        pid = f"p{len(self.panels) + 1}"
        self.panels.append({"type": obj_type, "panelIndex": pid, "panelRefName": f"panel_{pid}",
                            "gridData": {**self._place(w, h), "i": pid},
                            "embeddableConfig": {"enhancements": {}}})
        self.references.append({"type": obj_type, "id": obj_id, "name": f"{pid}:panel_{pid}"})
        return pid

    def lens(self, attrs, w, h, data_view=None):
        hide_title = attrs["visualizationType"] == "lnsMetric"  # the tile prints its own title
        # By reference, as its own `lens` saved object (also listed in the Visualize Library).
        # Lens embedded BY VALUE in an imported dashboard stayed on "loading" forever in
        # 8.17 without any error, while the identical state opened fine in the Lens editor.
        lens_id = f"{self.id}-p{len(self.panels) + 1}"
        self._by_reference("lens", lens_id, w, h)
        if hide_title:
            self.panels[-1]["embeddableConfig"]["hidePanelTitles"] = True
        self.visualizations.append({
            "id": lens_id, "type": "lens", "coreMigrationVersion": "8.8.0",
            "typeMigrationVersion": "8.9.0", "attributes": attrs,
            "references": [{"type": "index-pattern", "id": data_view or self.data_view,
                            "name": f"indexpattern-datasource-layer-{LAYER}"}]})
        return self

    def saved_search(self, search_id, w, h):
        self._by_reference("search", search_id, w, h)
        return self

    def to_saved_object(self):
        controls, refs = {}, list(self.references)
        for i, (field, title) in enumerate(self.controls):
            cid = f"{self.id}-control-{i}"
            controls[cid] = {"order": i, "width": "medium", "grow": True,
                             "type": "optionsListControl",
                             "explicitInput": {"id": cid, "fieldName": field, "title": title,
                                               "selectedOptions": [], "enhancements": {}}}
            refs.append({"type": "index-pattern", "id": self.data_view,
                         "name": f"controlGroup_{cid}:optionsListDataView"})
        return {
            "id": self.id, "type": "dashboard", "coreMigrationVersion": "8.8.0",
            "typeMigrationVersion": "10.2.0", "references": refs,
            "attributes": {
                "title": self.title, "description": self.description,
                "panelsJSON": json.dumps(self.panels),
                "optionsJSON": json.dumps({"useMargins": True, "syncColors": False,
                                           "syncCursor": True, "syncTooltips": True,
                                           "hidePanelTitles": False}),
                "timeRestore": True, "timeFrom": self.time_from, "timeTo": "now",
                "refreshInterval": {"pause": False, "value": 30000},
                "controlGroupInput": {
                    "chainingSystem": "HIERARCHICAL", "controlStyle": "oneLine",
                    "showApplySelections": False,
                    "ignoreParentSettingsJSON": json.dumps({
                        "ignoreFilters": False, "ignoreQuery": False,
                        "ignoreTimerange": False, "ignoreValidations": False}),
                    "panelsJSON": json.dumps(controls)},
                "kibanaSavedObjectMeta": {"searchSourceJSON": json.dumps(
                    {"query": {"query": "", "language": "kuery"}, "filter": []})},
            },
        }


overview = (
    Dashboard("smartbreeds-overview", "SmartBreeds · Platform Overview",
              "Health of every container at a glance: volume, severity and who is erroring.",
              [("service", "Service"), ("level", "Level")])
    .lens(stat("Log events", count("Log events")), 8, 6)
    .lens(stat("Errors", count("Errors", "level:(ERROR or CRITICAL)")), 8, 6)
    .lens(stat("Warnings", count("Warnings", "level:WARNING")), 8, 6)
    .lens(stat("Requests (edge)", count("Requests"), EDGE), 8, 6)
    .lens(stat("Server errors (5xx)", count("5xx", "http.status_class:5xx"), EDGE), 8, 6)
    .lens(stat("Active users", metric("unique_count", "user.id", "Users"),
               f"{GATEWAY} and not user.id:anonymous"), 8, 6)
    .lens(xy("Log volume by service", "bar_stacked",
             {"x": date(), "s": terms("service", "Service", "m", size=12), "m": count("Events")},
             split="s", accessors=["m"], y_title="Events"), 32, 13)
    .lens(donut("Share of logs by service", "service", "Service"), 16, 13)
    .lens(levels_over_time("Severity over time"), 24, 12)
    .lens(by_term("Top services by errors & warnings", "service", "Service",
                  count("Errors & warnings"), PROBLEMS), 24, 12)
    .saved_search("smartbreeds-problems-search", 48, 16)
)

traffic = (
    Dashboard("smartbreeds-http", "SmartBreeds · HTTP Traffic",
              "User-facing traffic as nginx sees it (edge layer), plus per-route latency "
              "measured inside the API gateway. Healthcheck probes are excluded.",
              [("http.method", "Method"), ("http.status_class", "Status class"),
               ("url.path", "Path")])
    .lens(stat("Requests", count("Requests"), EDGE), 8, 6)
    .lens(stat("Client errors (4xx)", count("4xx", "http.status_class:4xx"), EDGE), 8, 6)
    .lens(stat("Server errors (5xx)", count("5xx", "http.status_class:5xx"), EDGE), 8, 6)
    .lens(stat("Median latency", metric("median", "http.duration_ms", "p50", MS), EDGE), 8, 6)
    .lens(stat("p95 latency", metric("percentile", "http.duration_ms", "p95", MS,
                                     percentile=95), EDGE), 8, 6)
    .lens(stat("Data sent", metric("sum", "http.response_bytes", "Bytes",
                                   {"id": "bytes", "params": {"decimals": 1}}), EDGE), 8, 6)
    .lens(status_over_time("Requests by status class", EDGE), 32, 13)
    .lens(donut("Status codes", "http.status", "Status", EDGE, data_type="number"), 16, 13)
    .lens(latency_over_time("Edge latency percentiles", EDGE), 24, 12)
    .lens(by_term("Slowest routes (gateway p95)", "url.path", "Route",
                  metric("percentile", "http.duration_ms", "p95", MS, percentile=95),
                  GATEWAY), 24, 12)
    .lens(table("Top endpoints", {
        "path": terms("url.path", "Path", "n", size=20, other=False),
        "n": count("Requests"),
        "e4": count("4xx", "http.status_class:4xx"),
        "e5": count("5xx", "http.status_class:5xx"),
        "p50": metric("median", "http.duration_ms", "p50", MS),
        "p95": metric("percentile", "http.duration_ms", "p95", MS, percentile=95),
    }, EDGE), 32, 15)
    .lens(table("Top clients", {
        "ip": terms("client.ip", "Client IP", "n", size=15, other=False, data_type="ip"),
        "n": count("Requests"),
        "e4": count("4xx", "http.status_class:4xx"),
    }, EDGE), 16, 15)
)

security = (
    Dashboard("smartbreeds-security", "SmartBreeds · Security & Auth",
              "Authentication outcomes, rejected requests and rate limiting, from the edge.",
              [("http.status", "Status"), ("client.ip", "Client IP")])
    .lens(stat("Logins OK", count("Logins", "http.status_class:2xx"),
               f"{EDGE} and {LOGIN} and http.method:POST"), 8, 6)
    .lens(stat("Logins failed", count("Failed", "http.status_class:4xx"),
               f"{EDGE} and {LOGIN} and http.method:POST"), 8, 6)
    .lens(stat("401 Unauthorized", count("401", "http.status:401"), EDGE), 8, 6)
    .lens(stat("403 Forbidden", count("403", "http.status:403"), EDGE), 8, 6)
    .lens(stat("429 Rate limited", count("429", "http.status:429"), EDGE), 8, 6)
    .lens(stat("Distinct client IPs", metric("unique_count", "client.ip", "IPs"), EDGE), 8, 6)
    .lens(over_time("Rejected requests over time", {
        "u": count("401", "http.status:401"),
        "f": count("403", "http.status:403"),
        "r": count("429", "http.status:429"),
    }, EDGE, {"u": WARN, "f": SERIOUS, "r": CRITICAL}, y_title="Requests"), 24, 12)
    .lens(status_over_time("Login attempts by outcome",
                           f"{EDGE} and {LOGIN} and http.method:POST"), 24, 12)
    .lens(by_term("Routes answering 401/403", "url.path", "Route",
                  count("Rejections"), f"{EDGE} and http.status:(401 or 403)"), 24, 12)
    .lens(table("Clients with the most rejections", {
        "ip": terms("client.ip", "Client IP", "n", size=15, other=False, data_type="ip"),
        "n": count("Rejected"),
        "u": count("401", "http.status:401"),
        "r": count("429", "http.status:429"),
    }, f"{EDGE} and http.status:(401 or 403 or 429)"), 24, 12)
    .lens(over_time("Active users (gateway)", {
        "m": metric("unique_count", "user.id", "Users")},
        f"{GATEWAY} and not user.id:anonymous", series="line", y_title="Users"), 24, 12)
    .lens(by_term("Busiest users", "user.id", "User ID", count("Requests"),
                  f"{GATEWAY} and not user.id:anonymous"), 24, 12)
    .saved_search("smartbreeds-security-search", 48, 15)
)

ai = (
    Dashboard("smartbreeds-ai", "SmartBreeds · AI Pipeline",
              "Vision analyses end to end: gateway outcome and latency, the classification "
              "stages behind them, and the LLM calls through LiteLLM. 422 = the pipeline "
              "rejected the image (NSFW, not a cat/dog, breed unclear).",
              [("service", "Service")])
    .lens(stat("Analyses", count("Analyses"), VISION), 8, 6)
    .lens(stat("Succeeded", count("2xx", "http.status_class:2xx"), VISION), 8, 6)
    .lens(stat("Rejected images (422)", count("422", "http.status:422"), VISION), 8, 6)
    .lens(stat("Failed (5xx)", count("5xx", "http.status_class:5xx"), VISION), 8, 6)
    .lens(stat("p95 analysis time", metric("percentile", "http.duration_ms", "p95", MS,
                                           percentile=95), VISION), 8, 6)
    .lens(stat("LLM calls", count("Calls"),
               'service:litellm and url.path:"/v1/chat/completions"'), 8, 6)
    .lens(status_over_time("Analyses by outcome", VISION), 24, 12)
    .lens(latency_over_time("Analysis latency percentiles", VISION), 24, 12)
    .lens(over_time("Classification stages", {
        "nsfw": count("Content (NSFW)", 'url.path:"/classify/content"'),
        "species": count("Species", 'url.path:"/classify/species"'),
        "breed": count("Breed", 'url.path:"/classify/breed"'),
    }, "service:classification-service and log_type:access and not healthcheck:true",
        y_title="Calls"), 24, 12)
    .lens(status_over_time("LLM calls by status (LiteLLM)",
                           'service:litellm and url.path:"/v1/chat/completions"'), 24, 12)
    .lens(levels_over_time("AI services severity",
                           "service:(ai-service or classification-service or litellm)"), 24, 12)
    .lens(by_term("Errors & warnings by AI service", "service", "Service",
                  count("Errors & warnings"),
                  f"service:(ai-service or classification-service or litellm) and {PROBLEMS}"),
          24, 12)
    .saved_search("smartbreeds-ai-problems-search", 48, 15)
)

# One Heartbeat document per monitor run; summary.up is 1 for a passing check, 0 for a failing one,
# so its average is the availability. Durations are recorded in microseconds.
UP, DOWN = "monitor.status:up", "monitor.status:down"
PCT = {"id": "percent", "params": {"decimals": 2}}
US = {"id": "number", "params": {"decimals": 0, "suffix": " µs"}}
BACKUP_OK = 'service:db-backup and message:"BACKUP_VERIFY OK"'
BACKUP_FAILED = 'service:db-backup and message:"BACKUP_VERIFY FAILED"'

status = (
    Dashboard("smartbreeds-status", "SmartBreeds · Service Status",
              "Status page. Heartbeat probes every service every 30-60 s; the app services on "
              "/health/ready, which round-trips to Postgres (or Redis for the gateway). Below: "
              "the hourly Postgres backups, each restored into a scratch DB to prove it works.",
              [("monitor.name", "Monitor"), ("tags", "Group")],
              data_view=UPTIME_VIEW, time_from="now-24h")
    .lens(stat("Monitors", metric("unique_count", "monitor.id", "Monitors")), 8, 6)
    .lens(stat("Availability", metric("average", "summary.up", "Availability", PCT)), 8, 6)
    .lens(stat("Failed checks", count("Failed checks", DOWN)), 8, 6)
    .lens(stat("p95 response", metric("percentile", "monitor.duration.us", "p95", US,
                                      percentile=95)), 8, 6)
    .lens(stat("Backups verified", count("Verified", BACKUP_OK)), 8, 6, data_view=DATA_VIEW)
    .lens(stat("Backup failures", count("Failures", BACKUP_FAILED)), 8, 6, data_view=DATA_VIEW)
    .lens(table("Current status", {
        "name": terms("monitor.name", "Monitor", "avail", size=30, other=False),
        "last": last_value("monitor.status", "Last status"),
        "avail": metric("average", "summary.up", "Availability", PCT),
        "down": count("Failed checks", DOWN),
        "p95": metric("percentile", "monitor.duration.us", "p95", US, percentile=95),
    }), 48, 16)
    .lens(over_time("Checks by outcome", {
        "up": count("Up", UP),
        "down": count("Down", DOWN),
    }, colors={"up": GOOD, "down": CRITICAL}, y_title="Checks"), 24, 12)
    .lens(by_term("Failed checks by monitor", "monitor.name", "Monitor",
                  count("Failed checks"), DOWN), 24, 12)
    .lens(xy("Response time p95 by monitor", "line",
             {"x": date(), "s": terms("monitor.name", "Monitor", "m", size=15, other=False),
              "m": metric("percentile", "monitor.duration.us", "p95", US, percentile=95)},
             split="s", accessors=["m"], y_title="p95 (µs)"), 48, 13)
    .saved_search("smartbreeds-backup-search", 48, 12)
)

SEARCHES.append(search(
    "smartbreeds-backup-search", "Backup runs",
    "One line per hourly Postgres backup: the dump was restored into a scratch database and "
    "checked (BACKUP_VERIFY OK) or not (BACKUP_VERIFY FAILED, with the reason).",
    'service:db-backup and message:"BACKUP_VERIFY"', ["level", "message"]))

DASHBOARDS = [status, overview, traffic, security, ai]


def main():
    objects = SEARCHES + [v for d in DASHBOARDS for v in d.visualizations] \
        + [d.to_saved_object() for d in DASHBOARDS]
    OUT.write_text("".join(json.dumps(o, ensure_ascii=False) + "\n" for o in objects))
    print(f"wrote {len(objects)} saved objects to {OUT}")


if __name__ == "__main__":
    main()
