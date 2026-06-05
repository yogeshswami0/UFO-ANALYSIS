import os
import urllib.request
import pandas as pd
import numpy as np
import json
import re
import html

# Define paths
CSV_URL = 'https://raw.githubusercontent.com/mayaman/UFOSightings/master/ufo_data.csv'
RAW_CSV_PATH = 'ufo_data.csv'
CLEAN_CSV_PATH = 'ufo_data_clean.csv'
DATA_DIR = 'public/data'

def download_dataset():
    if not os.path.exists(RAW_CSV_PATH):
        print(f"Downloading dataset from {CSV_URL}...")
        req = urllib.request.Request(CSV_URL, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req) as response:
            content = response.read().decode('utf-8')
        
        # Prepend headers as this raw source file lacks them
        headers = "datetime,city,state,country,shape,duration (seconds),duration (hours/min),comments,date posted,latitude,longitude\n"
        with os.fdopen(os.open(RAW_CSV_PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o666), 'w', encoding='utf-8') as f:
            f.write(headers)
            f.write(content)
        print("Raw dataset downloaded and headers prepended.")
    else:
        print("Raw dataset already exists.")

def clean_comment(text):
    if not isinstance(text, str):
        return ""
    # Decode HTML entities (like &#44; and &amp;)
    text = html.unescape(text)
    # Remove HTML tags if any
    text = re.sub(r'<[^>]*>', '', text)
    # Clean up multiple whitespaces
    text = re.sub(r'\s+', ' ', text).strip()
    return text

def clean_and_process():
    print("Loading raw dataset...")
    df = pd.read_csv(RAW_CSV_PATH, on_bad_lines='skip', low_memory=False)
    print(f"Initial shape: {df.shape}")

    # 1. Convert datetime and handle 24:00 time format
    print("Cleaning datetime column...")
    df['datetime'] = df['datetime'].astype(str)
    mask = df['datetime'].str.endswith('24:00')
    df.loc[mask, 'datetime'] = df.loc[mask, 'datetime'].str.replace('24:00', '00:00')
    df['datetime'] = pd.to_datetime(df['datetime'], errors='coerce')
    df.loc[mask, 'datetime'] += pd.Timedelta(days=1)
    
    # 2. Convert and clean columns
    print("Formatting numeric fields and dates...")
    df['duration (seconds)'] = pd.to_numeric(df['duration (seconds)'], errors='coerce')
    df['date posted'] = pd.to_datetime(df['date posted'], errors='coerce')
    df['latitude'] = pd.to_numeric(df['latitude'], errors='coerce')
    df['longitude'] = pd.to_numeric(df['longitude'], errors='coerce')

    # Drop null coordinates
    df = df.dropna(subset=['latitude', 'longitude'])

    # 3. Clean duration (remove non-positive and keep only <= 96th percentile)
    print("Filtering duration outliers...")
    df = df[df['duration (seconds)'] > 0]
    upper_limit = df['duration (seconds)'].quantile(0.96)
    df = df[df['duration (seconds)'] <= upper_limit]

    # 4. Clean countries using city information mapped in the notebook
    print("Resolving country names...")
    df['city'] = df['city'].astype(str)
    df['city_info'] = df['city'].str.extract(r"\((.*?)\)")
    
    # Strip parentheses from city name
    df['city'] = df['city'].str.replace(r"\(.*?\)", "", regex=True).str.strip()
    
    mapping = {
        'de': 'Germany', 'gb': 'United Kingdom', 'us': 'United States',
        'au': 'Australia', 'ca': 'Canada',
        'canada': 'Canada', 'australia': 'Australia',
        'nsw&#44 australia': 'Australia', 'vic&#44 australia': 'Australia',
        'qld&#44 australia': 'Australia', 'south australia': 'Australia',
        'western australia': 'Australia',
        'uk/england': 'United Kingdom', 'uk/scotland': 'United Kingdom',
        'uk/wales': 'United Kingdom', 'republic of ireland': 'Ireland',
        'new zealand': 'New Zealand', 'mexico': 'Mexico', 'germany': 'Germany',
        'spain': 'Spain', 'france': 'France', 'sweden': 'Sweden',
        'italy': 'Italy', 'belgium': 'Belgium', 'norway': 'Norway',
        'denmark': 'Denmark', 'switzerland': 'Switzerland', 'argentina': 'Argentina',
        'brazil': 'Brazil', 'netherlands': 'Netherlands', 'philippines': 'Philippines',
        'south africa': 'South Africa', 'pakistan': 'Pakistan', 'japan': 'Japan',
        'china': 'China', 'israel': 'Israel', 'portugal': 'Portugal',
        'turkey': 'Turkey', 'romania': 'Romania', 'croatia': 'Croatia',
        'finland': 'Finland', 'greece': 'Greece', 'chile': 'Chile',
        'venezuela': 'Venezuela', 'costa rica': 'Costa Rica'
    }

    df['city_info_clean'] = df['city_info'].str.lower().map(mapping)
    df['country_mapped'] = df['country'].str.lower().map(mapping)
    
    # Fill missing countries
    df['country'] = df['country_mapped']
    df.loc[df['country'].isna(), 'country'] = df['city_info_clean']
    
    # Default uncategorized ones to Unknown or drop? Let's keep them as "Unknown Country" if null
    df['country'] = df['country'].fillna('Unknown Country')
    
    # Clean casing
    df['city'] = df['city'].str.title()
    df['state'] = df['state'].str.upper().fillna('')
    df['shape'] = df['shape'].str.title().fillna('Unknown')
    df['comments'] = df['comments'].apply(clean_comment)

    # Remove temporary columns
    df.drop(columns=['city_info', 'city_info_clean', 'country_mapped'], inplace=True, errors='ignore')

    # Drop any remaining rows that failed datetime parse
    df = df.dropna(subset=['datetime'])

    # Save cleaned file
    print(f"Cleaned shape: {df.shape}")
    df.to_csv(CLEAN_CSV_PATH, index=False)
    print(f"Cleaned dataset saved to {CLEAN_CSV_PATH}.")
    return df

def aggregate_and_save(df):
    print("Generating aggregations for dashboard...")
    os.makedirs(DATA_DIR, exist_ok=True)

    # 1. Year trend
    df['year'] = df['datetime'].dt.year
    year_counts = df.groupby('year').size().sort_index()
    year_data = {
        "years": [int(y) for y in year_counts.index],
        "counts": [int(c) for c in year_counts.values]
    }
    with open(os.path.join(DATA_DIR, 'sightings_by_year.json'), 'w') as f:
        json.dump(year_data, f)

    # 2. Shape distribution
    shape_counts = df.groupby('shape').size().sort_values(ascending=False)
    top_shapes = shape_counts.head(12)
    other_shapes_sum = shape_counts.iloc[12:].sum()
    shapes = list(top_shapes.index)
    counts = [int(c) for c in top_shapes.values]
    if other_shapes_sum > 0:
        shapes.append("Other")
        counts.append(int(other_shapes_sum))
    shape_data = {
        "shapes": shapes,
        "counts": counts
    }
    with open(os.path.join(DATA_DIR, 'sightings_by_shape.json'), 'w') as f:
        json.dump(shape_data, f)

    # 3. Country distribution
    country_counts = df.groupby('country').size().sort_values(ascending=False)
    country_data = {
        "countries": list(country_counts.index),
        "counts": [int(c) for c in country_counts.values]
    }
    with open(os.path.join(DATA_DIR, 'sightings_by_country.json'), 'w') as f:
        json.dump(country_data, f)

    # 4. Month distribution
    df['month'] = df['datetime'].dt.month
    month_names = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]
    month_counts = df.groupby('month').size().sort_index()
    # Re-index to ensure all months 1-12 are present
    month_counts = month_counts.reindex(range(1, 13), fill_value=0)
    month_data = {
        "months": month_names,
        "counts": [int(c) for c in month_counts.values]
    }
    with open(os.path.join(DATA_DIR, 'sightings_by_month.json'), 'w') as f:
        json.dump(month_data, f)

    # 5. Hour distribution
    df['hour'] = df['datetime'].dt.hour
    hour_counts = df.groupby('hour').size().sort_index()
    hour_counts = hour_counts.reindex(range(0, 24), fill_value=0)
    hour_labels = [f"{h:02d}:00" for h in range(0, 24)]
    hour_data = {
        "hours": hour_labels,
        "counts": [int(c) for c in hour_counts.values]
    }
    with open(os.path.join(DATA_DIR, 'sightings_by_hour.json'), 'w') as f:
        json.dump(hour_data, f)

    # 6. Optimized Sighting coordinates for the 3D Globe map (3000 points)
    # Stratified/Random sampling to avoid overloading WebGL
    sample_size = min(3000, len(df))
    # We sample representatively
    map_df = df.sample(n=sample_size, random_state=42).copy()
    
    # Sort map points by year for timeline scrubbing in frontend
    map_df['year'] = map_df['datetime'].dt.year
    map_df = map_df.sort_values(by='year')
    
    map_points = []
    for _, row in map_df.iterrows():
        map_points.append({
            "lat": float(row['latitude']),
            "lng": float(row['longitude']),
            "city": str(row['city']),
            "state": str(row['state']),
            "country": str(row['country']),
            "shape": str(row['shape']),
            "year": int(row['year']),
            "date": row['datetime'].strftime('%Y-%m-%d %H:%M'),
            "duration": float(row['duration (seconds)']),
            "desc": str(row['comments'])[:120] + ("..." if len(str(row['comments'])) > 120 else "")
        })
        
    with open(os.path.join(DATA_DIR, 'map_sightings.json'), 'w') as f:
        json.dump(map_points, f)

    # 7. Summary metrics
    top_c = country_counts.index[0] if len(country_counts) > 0 else 'N/A'
    top_s = shape_counts.index[0] if len(shape_counts) > 0 else 'N/A'
    peak_h_val = hour_counts.idxmax()
    peak_h = f"{peak_h_val:02d}:00 - {(peak_h_val+1)%24:02d}:00"
    
    summary_data = {
        "total_sightings": int(len(df)),
        "top_country": top_c,
        "top_shape": top_s,
        "peak_hour": peak_h,
        "latest_year": int(df['year'].max()),
        "earliest_year": int(df['year'].min())
    }
    with open(os.path.join(DATA_DIR, 'summary.json'), 'w') as f:
        json.dump(summary_data, f)
        
    print("All dashboard data files generated successfully in public/data/!")

if __name__ == '__main__':
    download_dataset()
    cleaned_df = clean_and_process()
    aggregate_and_save(cleaned_df)
