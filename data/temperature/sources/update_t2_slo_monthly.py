#!/usr/bin/env python3
import numpy as np
import pandas as pd

# TODO: add the actual data source

data = []
for year in range(1961, 2021):
    year_list = []
    for month in ['jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']:
        file = f't2_slo_monthly/t2{year}{month}ak.asc'
        year_list.append(np.loadtxt(file, skiprows=6))
    data.append(np.asarray(year_list))

averages = [np.flipud(np.mean(year, axis=0)) for year in data]
overall_average = np.mean(averages, axis=0)
overall_half_average = np.mean(averages[:31], axis=0)
running_averages = [np.mean(averages[i:i + 10], axis=0) for i in range(len(data) - 9)]
masked_averages = [np.ma.masked_array(year, mask=year < -1000) for year in averages]
masked_running_averages = [np.ma.masked_array(year, mask=year < -1000) for year in running_averages]
masked_running_averages_uber = [np.ma.masked_array(year - overall_average, mask=year < -1000) for year in running_averages]
masked_running_averages_half = [np.ma.masked_array(year - overall_half_average, mask=year < -1000) for year in running_averages]

year_list = list(range(1961, 2021))
year_ranges = [(year, year+9) for year in year_list[:-9]]
total_averages = np.asarray([[y, np.mean(year)] for y, year in zip(year_list, masked_averages)])
uber_average = np.mean(total_averages[:, 1])
half_average = np.mean(total_averages[:26, 1])
running_total_averages = np.asarray([[y[1], np.mean(year)] for y, year in zip(year_ranges, masked_running_averages)])
running_total_averages_uber = np.asarray([[y[1], np.mean(year) - uber_average] for y, year in zip(year_ranges, masked_running_averages)])
running_total_averages_half = np.asarray([[y[1], np.mean(year) - half_average] for y, year in zip(year_ranges, masked_running_averages)])

df = pd.DataFrame(total_averages, columns=['year', 'temperature_average'])
df = df.astype({'year': 'int32'})
print(df)
print(df.dtypes)
df.to_csv("../data/temperature.slovenia.historical.country_yearly_average.csv", index=False, float_format='%.3f')

df = pd.DataFrame(running_total_averages, columns=['year_end', 'temperature_average'])
df = df.astype({'year_end': 'int32'})
df.insert(0, 'year_start', df['year_end'] - 9)
print(df)
print(df.dtypes)
df.to_csv("../data/temperature.slovenia.historical.country_running_10year_average.csv", index=False, float_format='%.3f')


matrix_data = []
for y, matrix in zip(year_ranges, running_averages):
    for i in range(len(matrix)):
        for j in range(len(matrix[i])):
            if matrix[i][j] < - 1000:
                continue
            matrix_data.append([y[1], i, j, matrix[i][j]])

df = pd.DataFrame(matrix_data, columns=['year_end', 'x', 'y', 'temperature_average'])
df = df.astype({'year_end': 'int32'})
df.insert(0, 'year_start', df['year_end'] - 9)
print(df)
print(df.dtypes)
df.to_csv("../data/temperature.slovenia.historical.map_running_10year_average.csv", index=False, float_format='%.3f')
