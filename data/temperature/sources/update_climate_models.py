#!/usr/bin/env python3
import numpy as np
import pandas as pd
from netCDF4 import Dataset
from scipy.interpolate import RectBivariateSpline

# variables of interest
var_all = ["ensmean", "perc10", "perc25", "perc75", "perc90"]
# variable labels
var_column = {
    "ensmean": "temperature_ensemble_mean",
    "perc10": "temperature_percentile_10",
    "perc25": "temperature_percentile_25",
    "perc75": "temperature_percentile_75",
    "perc90": "temperature_percentile_90"
}

# create grid
ln = np.arange(0, 360.1, 0.25)
lt = np.arange(-90, 90.1, 0.25)
lons, lats = np.meshgrid(ln, lt)
dim = lons.shape[0] * lons.shape[1]

# full dataframe placeholder
full_df = None

# loop over variables
for var in var_all:
    # load CMIP6 ensmean data 1850-2099 ensmean was obtained from anomalous tas from CMIP6 models and then ERA5 1981-2010 climatology was added on top
    if "25" in var or "75" in var:
        file = Dataset("climate_models/ensmean_perc25_perc75_18502099.nc", "r")
    else:
        file = Dataset("climate_models/ensmean_perc10_perc90_one_per_centre_18502099.nc", "r")

    # read data
    t2m = file.variables[var][:]
    lons_surf = file.variables["lon"][:]
    lats_surf = file.variables["lat"][:]

    # merge data and transform from kelvin to celsius scale
    t2m = t2m - 273.15
    n = t2m.shape[0]

    # compute 10-year running means
    data = np.reshape(t2m, (len(t2m[:, 0, 0]), len(t2m[0, :, 0]) * len(t2m[0, 0, :])))  # reshape 4D to 2D data
    df = pd.DataFrame(data)  # get dataframe
    data = df.rolling(window=10, min_periods=1, axis=0,
                      center=True).mean().iloc[:, :].values  # running mean
    data_10yrt = np.reshape(data, (len(t2m[:, 0, 0]), len(t2m[0, :, 0]), len(t2m[0, 0, :])))  # 2D data back to 4D data

    # variable dataframe placeholder
    var_df = None

    # loop over averages
    for i in range(6, n+5, 10):
        year_min = 1850 + i - 6
        year_max = 1850 + i - 6 + 9
        print("Year: ", year_min, "-", year_max)

        # perform interpolation
        xx = np.arange(0, 360, 0.25)
        yy = np.arange(-90., 90.1, 0.25)

        tint = RectBivariateSpline(lons_surf, lats_surf, data_10yrt[i].T)
        t2m_int = tint(xx, yy).T
        data = t2m_int[:]
        X = data[:, 0]
        X = np.reshape(X, (X.size, 1))
        data = np.concatenate((data[:, :], X), axis=1)

        # dictionary of lists
        data_dict = {'year_start': np.full((dim,), year_min), 'year_end': np.full((dim,), year_max), 'latitude': lats.flatten(), 'longitude': lons.flatten(), 'temperature': data.flatten()}

        # create dataframe
        df = pd.DataFrame(data_dict)
        df['longitude'] = np.where(df['longitude'] > 180, df['longitude'] - 360, df['longitude'])
        # filter out data outside of the region of interest
        df = df[(df.longitude > -15) & (df.longitude < 65) &
                (df.latitude > 20) & (df.latitude < 75)]

        # append to variable dataframe
        if var_df is None:
            var_df = df
        else:
            var_df = pd.concat([var_df, df])

    # rename columns
    var_df.rename(columns={'temperature': var_column[var]}, inplace=True)

    # append to full dataframe
    if full_df is None:
        full_df = var_df
    else:
        full_df[var_column[var]] = var_df[var_column[var]]

# round
rounding = 2
full_df = full_df.round({'temperature_ensemble_mean': rounding, 'temperature_percentile_10': rounding, 'temperature_percentile_25': rounding, 'temperature_percentile_75': rounding, 'temperature_percentile_90': rounding})

# print and save
print(full_df)
print(full_df.dtypes)
full_df.to_csv("../data/temperature.climate_models.map_running_10year_average.csv", index=False)
