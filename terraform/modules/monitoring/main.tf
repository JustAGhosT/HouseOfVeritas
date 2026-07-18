resource "azurerm_log_analytics_workspace" "main" {
  name                = var.workspace_name
  resource_group_name = var.resource_group_name
  location            = var.location
  sku                 = "PerGB2018"
  retention_in_days   = 30

  tags = var.tags
}

resource "azurerm_monitor_action_group" "alerts" {
  name                = "${var.workspace_name}-alerts"
  resource_group_name = var.resource_group_name
  short_name          = "HOVAlerts"

  email_receiver {
    name          = "admin"
    email_address = var.alert_email
  }

  tags = var.tags
}

resource "azurerm_monitor_metric_alert" "db_cpu" {
  count               = var.enable_database_alerts ? 1 : 0
  name                = "db-cpu-high"
  resource_group_name = var.resource_group_name
  scopes              = [var.database_server_id]
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.DBforPostgreSQL/flexibleServers"
    metric_name      = "cpu_percent"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 80
  }

  action {
    action_group_id = azurerm_monitor_action_group.alerts.id
  }

  lifecycle {
    precondition {
      condition     = var.database_server_id != ""
      error_message = "database_server_id must be provided when enable_database_alerts is true"
    }
  }

  tags = var.tags
}

resource "azurerm_monitor_metric_alert" "function_failures" {
  count               = var.enable_function_alerts ? 1 : 0
  name                = "func-failures"
  resource_group_name = var.resource_group_name
  scopes              = [var.function_app_id]
  severity            = 2
  frequency           = "PT5M"
  window_size         = "PT5M"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "Http5xx"
    aggregation      = "Total"
    operator         = "GreaterThan"
    threshold        = 5
  }

  action {
    action_group_id = azurerm_monitor_action_group.alerts.id
  }

  lifecycle {
    precondition {
      condition     = var.function_app_id != ""
      error_message = "function_app_id must be provided when enable_function_alerts is true"
    }
  }

  tags = var.tags
}

resource "azurerm_monitor_metric_alert" "webapp_response_time" {
  count               = var.enable_webapp_alerts ? 1 : 0
  name                = "webapp-slow-response"
  resource_group_name = var.resource_group_name
  scopes              = [var.web_app_id]
  severity            = 3
  frequency           = "PT5M"
  window_size         = "PT15M"

  criteria {
    metric_namespace = "Microsoft.Web/sites"
    metric_name      = "HttpResponseTime"
    aggregation      = "Average"
    operator         = "GreaterThan"
    threshold        = 5
  }

  action {
    action_group_id = azurerm_monitor_action_group.alerts.id
  }

  lifecycle {
    precondition {
      condition     = var.web_app_id != ""
      error_message = "web_app_id must be provided when enable_webapp_alerts is true"
    }
  }

  tags = var.tags
}

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "radar_refresh_missing" {
  count                = var.enable_radar_alerts ? 1 : 0
  name                 = "radar-refresh-missing"
  resource_group_name  = var.resource_group_name
  location             = var.location
  scopes               = [var.function_app_insights_id]
  severity             = 2
  evaluation_frequency = "PT1H"
  window_duration      = "P1D"

  criteria {
    query                   = <<-KQL
      traces
      | where timestamp > ago(26h)
      | where message contains "DealRadarRefreshTelemetry"
      | summarize refresh_count = count()
      | where refresh_count < 1
    KQL
    time_aggregation_method = "Count"
    operator                = "GreaterThan"
    threshold               = 0

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.alerts.id]
  }

  lifecycle {
    precondition {
      condition     = var.function_app_insights_id != ""
      error_message = "function_app_insights_id must be provided when enable_radar_alerts is true"
    }
  }

  tags = var.tags
}

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "radar_zero_rows" {
  count                = var.enable_radar_alerts ? 1 : 0
  name                 = "radar-zero-rows"
  resource_group_name  = var.resource_group_name
  location             = var.location
  scopes               = [var.function_app_insights_id]
  severity             = 2
  evaluation_frequency = "PT1H"
  window_duration      = "P1D"

  criteria {
    query                   = <<-KQL
      traces
      | where timestamp > ago(25h)
      | where message contains "DealRadarRefreshZeroRows"
    KQL
    time_aggregation_method = "Count"
    operator                = "GreaterThan"
    threshold               = 0

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.alerts.id]
  }

  tags = var.tags
}

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "radar_quarantine_rows" {
  count                = var.enable_radar_alerts ? 1 : 0
  name                 = "radar-quarantine-rows"
  resource_group_name  = var.resource_group_name
  location             = var.location
  scopes               = [var.function_app_insights_id]
  severity             = 3
  evaluation_frequency = "PT1H"
  window_duration      = "P1D"

  criteria {
    query                   = <<-KQL
      traces
      | where timestamp > ago(25h)
      | where message contains "DealRadarRefreshQuarantine"
    KQL
    time_aggregation_method = "Count"
    operator                = "GreaterThan"
    threshold               = 0

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.alerts.id]
  }

  tags = var.tags
}

resource "azurerm_monitor_scheduled_query_rules_alert_v2" "radar_source_shape_drift" {
  count                = var.enable_radar_alerts ? 1 : 0
  name                 = "radar-source-shape-drift"
  resource_group_name  = var.resource_group_name
  location             = var.location
  scopes               = [var.function_app_insights_id]
  severity             = 2
  evaluation_frequency = "PT1H"
  window_duration      = "P1D"

  criteria {
    query                   = <<-KQL
      traces
      | where timestamp > ago(25h)
      | where message contains "DealRadarRefreshSourceShapeDrift"
    KQL
    time_aggregation_method = "Count"
    operator                = "GreaterThan"
    threshold               = 0

    failing_periods {
      minimum_failing_periods_to_trigger_alert = 1
      number_of_evaluation_periods             = 1
    }
  }

  action {
    action_groups = [azurerm_monitor_action_group.alerts.id]
  }

  tags = var.tags
}

resource "azurerm_consumption_budget_resource_group" "monthly" {
  count = var.enable_consumption_budget ? 1 : 0

  name              = "hov-monthly-budget"
  resource_group_id = var.resource_group_id

  amount     = var.monthly_budget
  time_grain = "Monthly"

  time_period {
    start_date = formatdate("YYYY-MM-01'T'00:00:00Z", timestamp())
  }

  notification {
    enabled        = true
    threshold      = 80
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Actual"

    contact_emails = [var.alert_email]
  }

  notification {
    enabled        = true
    threshold      = 100
    operator       = "GreaterThanOrEqualTo"
    threshold_type = "Forecasted"

    contact_emails = [var.alert_email]
  }

  lifecycle {
    ignore_changes = [time_period]
  }
}
