"""
Smart City Traffic and Logistics Analytics - Comprehensive Statistical Analyzer
Author: Senior Data Scientist / Analytics Engineer
Description:
    Conducts in-depth descriptive, comparative, and correlation analytics
    across 55 Indian cities, 6 geographical regions, 27,500 validated records.
    Computes key performance indicators (KPIs), correlations (Pearson r),
    city rankings, carrier leaderboards, and fuel efficiency metrics.
"""

import csv
import json
import math
import os
from collections import defaultdict

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_DIR = os.path.join(BASE_DIR, "data")

def load_data():
    """Loads cleaned traffic, logistics, and master datasets."""
    with open(os.path.join(DATA_DIR, "city_master.csv"), "r", encoding="utf-8") as f:
        cities = list(csv.DictReader(f))
    with open(os.path.join(DATA_DIR, "cleaned_traffic_data.csv"), "r", encoding="utf-8") as f:
        traffic = list(csv.DictReader(f))
    with open(os.path.join(DATA_DIR, "cleaned_logistics_data.csv"), "r", encoding="utf-8") as f:
        logistics = list(csv.DictReader(f))
    return cities, traffic, logistics

def compute_pearson_correlation(x_vals, y_vals):
    """Calculates Pearson correlation coefficient r and linear regression line."""
    n = len(x_vals)
    if n < 2:
        return 0.0, 0.0, 0.0
    mean_x = sum(x_vals) / n
    mean_y = sum(y_vals) / n
    cov = sum((x - mean_x) * (y - mean_y) for x, y in zip(x_vals, y_vals))
    var_x = sum((x - mean_x) ** 2 for x in x_vals)
    var_y = sum((y - mean_y) ** 2 for y in y_vals)
    if var_x == 0 or var_y == 0:
        return 0.0, 0.0, 0.0
    r = cov / math.sqrt(var_x * var_y)
    slope = cov / var_x
    intercept = mean_y - slope * mean_x
    return round(r, 4), round(slope, 4), round(intercept, 4)

def run_analysis():
    cities, traffic, logistics = load_data()
    print(f"Loaded: {len(cities)} Cities | {len(traffic):,} Traffic Records | {len(logistics):,} Logistics Records")

    # 1. City-wise Congestion Analysis
    city_trf = defaultdict(list)
    for t in traffic:
        cname = t["City_Name"]
        city_trf[cname].append({
            "speed": float(t["Average_Speed"]),
            "cong": float(t["Congestion_Level"]),
            "count": int(t["Vehicle_Count"]),
            "wait": float(t["Waiting_Time"]),
            "accident": int(t["Accident_Count"])
        })

    city_stats = {}
    for cname, records in city_trf.items():
        n = len(records)
        avg_speed = sum(r["speed"] for r in records) / n
        avg_cong = sum(r["cong"] for r in records) / n
        total_veh = sum(r["count"] for r in records)
        avg_wait = sum(r["wait"] for r in records) / n
        total_accidents = sum(r["accident"] for r in records)
        city_stats[cname] = {
            "City_Name": cname,
            "Record_Count": n,
            "Average_Speed_kmh": round(avg_speed, 2),
            "Average_Congestion_Pct": round(avg_cong, 2),
            "Total_Vehicles_Logged": total_veh,
            "Average_Wait_Time_mins": round(avg_wait, 2),
            "Total_Accidents": total_accidents
        }

    # Top 10 Most Congested Cities
    top10_congested = sorted(city_stats.values(), key=lambda x: x["Average_Congestion_Pct"], reverse=True)[:10]

    # 2. Logistics Delivery Performance & City Delays
    city_log = defaultdict(list)
    company_log = defaultdict(list)
    vehicle_log = defaultdict(list)

    total_deliveries = len(logistics)
    on_time_count = 0
    delayed_count = 0
    total_fuel = 0.0
    total_dist = 0.0

    for l in logistics:
        cname = l["City_Name"]
        comp = l["Logistics_Company"]
        vtype = l["Vehicle_Type"]
        dist = float(l["Distance_KM"])
        delay = float(l["Delivery_Delay_Minutes"])
        fuel = float(l["Fuel_Consumption"])
        status = l["Delivery_Status"]

        total_dist += dist
        total_fuel += fuel
        if status == "Delivered" and delay <= 0:
            on_time_count += 1
        elif delay > 0 or status in ["Delayed", "Returned to Origin (RTO)", "Cancelled"]:
            delayed_count += 1

        city_log[cname].append({"delay": delay, "dist": dist, "fuel": fuel, "status": status})
        company_log[comp].append({"delay": delay, "dist": dist, "fuel": fuel, "status": status})
        vehicle_log[vtype].append({"delay": delay, "dist": dist, "fuel": fuel})

    city_delay_stats = {}
    for cname, records in city_log.items():
        n = len(records)
        avg_delay = sum(r["delay"] for r in records) / n
        on_time = sum(1 for r in records if r["status"] == "Delivered" and r["delay"] <= 0)
        on_time_pct = (on_time / n) * 100.0
        city_delay_stats[cname] = {
            "City_Name": cname,
            "Delivery_Count": n,
            "Average_Delay_Minutes": round(avg_delay, 2),
            "On_Time_Delivery_Pct": round(on_time_pct, 2)
        }

    top10_delays = sorted(city_delay_stats.values(), key=lambda x: x["Average_Delay_Minutes"], reverse=True)[:10]

    # 3. Correlation between City Congestion and Delivery Delay
    common_cities = set(city_stats.keys()).intersection(set(city_delay_stats.keys()))
    corr_x = []
    corr_y = []
    for c in common_cities:
        corr_x.append(city_stats[c]["Average_Congestion_Pct"])
        corr_y.append(city_delay_stats[c]["Average_Delay_Minutes"])

    r_val, slope, intercept = compute_pearson_correlation(corr_x, corr_y)
    print(f"\n[Statistical Finding] Pearson Correlation (Congestion vs Delivery Delay): r = {r_val} (Slope = {slope}, Intercept = {intercept})")

    # 4. Region-wise Aggregation
    region_trf = defaultdict(list)
    for t in traffic:
        reg = t["Region"]
        region_trf[reg].append({
            "speed": float(t["Average_Speed"]),
            "cong": float(t["Congestion_Level"]),
            "count": int(t["Vehicle_Count"])
        })

    region_stats = {}
    for reg, items in region_trf.items():
        n = len(items)
        region_stats[reg] = {
            "Region": reg,
            "Records": n,
            "Average_Speed_kmh": round(sum(x["speed"] for x in items) / n, 2),
            "Average_Congestion_Pct": round(sum(x["cong"] for x in items) / n, 2),
            "Total_Vehicles": sum(x["count"] for x in items)
        }

    # 5. Company Leaderboard
    company_stats = {}
    for comp, items in company_log.items():
        n = len(items)
        avg_delay = sum(x["delay"] for x in items) / n
        on_time = sum(1 for x in items if x["status"] == "Delivered" and x["delay"] <= 0)
        tot_fuel = sum(x["fuel"] for x in items)
        tot_dist = sum(x["dist"] for x in items)
        fuel_per_km = tot_fuel / tot_dist if tot_dist > 0 else 0
        company_stats[comp] = {
            "Company": comp,
            "Deliveries": n,
            "Average_Delay_mins": round(avg_delay, 2),
            "On_Time_Pct": round((on_time / n) * 100.0, 2),
            "Fuel_Efficiency_L_per_KM": round(fuel_per_km, 4)
        }

    summary = {
        "Summary_Metrics": {
            "Total_Cities": len(cities),
            "Total_Traffic_Records": len(traffic),
            "Total_Logistics_Records": len(logistics),
            "National_Average_Speed_kmh": round(sum(float(t["Average_Speed"]) for t in traffic) / len(traffic), 2),
            "National_Average_Congestion_Pct": round(sum(float(t["Congestion_Level"]) for t in traffic) / len(traffic), 2),
            "On_Time_Delivery_Rate_Pct": round((on_time_count / total_deliveries) * 100.0, 2),
            "Delayed_Delivery_Pct": round((delayed_count / total_deliveries) * 100.0, 2),
            "Total_Distance_KM_Logged": round(total_dist, 1),
            "Total_Fuel_Litres_Burned": round(total_fuel, 1),
            "Congestion_Delay_Correlation_r": r_val
        },
        "Top10_Congested_Cities": top10_congested,
        "Top10_Delivery_Delay_Cities": top10_delays,
        "Region_Analytics": region_stats,
        "Company_Leaderboard": company_stats
    }

    # Save summary json
    summary_path = os.path.join(DATA_DIR, "analytics_summary.json")
    with open(summary_path, "w", encoding="utf-8") as f:
        json.dump(summary, f, indent=2)

    print(f"[✓] Saved comprehensive analytics summary to {summary_path}")
    return summary

if __name__ == "__main__":
    run_analysis()
