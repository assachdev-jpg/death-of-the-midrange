import glob
import os
import sys
import zipfile

import pandas as pd

RAW = sys.argv[1] if len(sys.argv) > 1 else '../nba-data'
OUT = 'data'

ZONES = {
    'Restricted Area': 'Rim',
    'In The Paint (Non-RA)': 'Short paint',
    'Mid-Range': 'Midrange',
    'Left Corner 3': 'Corner 3',
    'Right Corner 3': 'Corner 3',
    'Above the Break 3': 'Above-break 3',
}

cols = ['SEASON_1', 'GAME_ID', 'TEAM_NAME', 'SHOT_MADE', 'SHOT_TYPE', 'BASIC_ZONE', 'LOC_X', 'LOC_Y']


def read_season(path):
    if path.endswith('.zip'):
        with zipfile.ZipFile(path) as z:
            name = next(n for n in z.namelist() if n.endswith('.csv') and not n.startswith('__MACOSX'))
            with z.open(name) as f:
                return pd.read_csv(f, usecols=cols)
    return pd.read_csv(path, usecols=cols)


files = sorted(glob.glob(os.path.join(RAW, '**', 'NBA_*_Shots.csv*'), recursive=True))
files = [f for f in files if '__MACOSX' not in f and (f.endswith('.csv') or f.endswith('.zip'))]
print(f'Found {len(files)} files')

df = pd.concat((read_season(f) for f in files), ignore_index=True)
df = df[df['BASIC_ZONE'].isin(ZONES)]
df = df[df['LOC_Y'] <= 47]

df['season'] = df['SEASON_1']
df['zone'] = df['BASIC_ZONE'].map(ZONES)
df['made'] = df['SHOT_MADE'].astype(str).str.upper().eq('TRUE').astype(int)
df['points'] = df['made'] * df['SHOT_TYPE'].str[0].astype(int)
df['x'] = df['LOC_X'].round().astype(int)
df['y'] = df['LOC_Y'].round().astype(int)

team_games = (
    df.groupby('season')['GAME_ID'].nunique().mul(2).rename('team_games').reset_index()
)

grid = (
    df.groupby(['season', 'x', 'y', 'zone'])
    .agg(shots=('made', 'size'), makes=('made', 'sum'), points=('points', 'sum'))
    .reset_index()
)

zones = (
    df.groupby(['season', 'zone'])
    .agg(shots=('made', 'size'), makes=('made', 'sum'), points=('points', 'sum'))
    .reset_index()
    .merge(team_games, on='season')
)
zones['share'] = zones['shots'] / zones.groupby('season')['shots'].transform('sum')
zones['fg_pct'] = zones['makes'] / zones['shots']
zones['pts_per_shot'] = zones['points'] / zones['shots']
zones['shots_per_game'] = zones['shots'] / zones['team_games']

os.makedirs(OUT, exist_ok=True)
grid.to_csv(os.path.join(OUT, 'shot_grid.csv'), index=False)
zones.round(4).to_csv(os.path.join(OUT, 'zones_by_season.csv'), index=False)
team_games.to_csv(os.path.join(OUT, 'team_games.csv'), index=False)

print(f'{len(df):,} shots -> {len(grid):,} grid rows')
print(zones[zones['season'].isin([2004, 2025])][['season', 'zone', 'share', 'pts_per_shot']].round(3))