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
overall_average_1990 = np.mean(averages[:31], axis=0)
running_averages = [np.mean(averages[i:i + 10], axis=0) for i in range(len(data) - 9)]
masked_averages = [np.ma.masked_array(year, mask=year < -1000) for year in averages]
masked_running_averages = [np.ma.masked_array(year, mask=year < -1000) for year in running_averages]
masked_running_averages_difference = [np.ma.masked_array(year - overall_average, mask=year < -1000) for year in running_averages]
masked_running_averages_difference_1990 = [np.ma.masked_array(year - overall_average_1990, mask=year < -1000) for year in running_averages]

year_list = list(range(1961, 2021))
year_ranges = [(year, year+9) for year in year_list[:-9]]
total_averages = np.asarray([[y, np.mean(year)] for y, year in zip(year_list, masked_averages)])
total_average_overall = np.mean(total_averages[:, 1])
total_average_overall_1990 = np.mean(total_averages[:26, 1])
running_total_averages = np.asarray([[y[1], np.mean(year)] for y, year in zip(year_ranges, masked_running_averages)])
running_total_averages_difference = np.asarray([[y[1], np.mean(year) - total_average_overall] for y, year in zip(year_ranges, masked_running_averages)])
running_total_averages_difference_1990 = np.asarray([[y[1], np.mean(year) - total_average_overall_1990] for y, year in zip(year_ranges, masked_running_averages)])

special_averages = [
    [1961, 1990, total_average_overall_1990],
    [1961, 2020, total_average_overall],
]
df = pd.DataFrame(special_averages, columns=['year_start', 'year_end', 'temperature_average'])
df = df.astype({'year_start': 'int32', 'year_end': 'int32'})
print(df)
print(df.dtypes)
df.to_csv("../data/temperature.slovenia_historical.country_special_average.csv", index=False, float_format='%.3f')

df = pd.DataFrame(total_averages, columns=['year', 'temperature_average'])
df = df.astype({'year': 'int32'})
print(df)
print(df.dtypes)
df.to_csv("../data/temperature.slovenia_historical.country_yearly_average.csv", index=False, float_format='%.3f')

df = pd.DataFrame(running_total_averages, columns=['year_end', 'temperature_average'])
df = df.astype({'year_end': 'int32'})
df.insert(0, 'year_start', df['year_end'] - 9)
print(df)
print(df.dtypes)
df.to_csv("../data/temperature.slovenia_historical.country_running_10year_average.csv", index=False, float_format='%.3f')


matrix_data = []
for y, matrix in zip(year_ranges, running_averages):
    for i in range(len(matrix)):
        for j in range(len(matrix[i])):
            if matrix[i][j] < - 1000:
                continue
            matrix_data.append([y[1], j, i, matrix[i][j], matrix[i][j] - overall_average[i][j], matrix[i][j] - overall_average_1990[i][j]])

df = pd.DataFrame(matrix_data, columns=['year_end', 'x', 'y', 'temperature_average', 'temperature_difference_to_average', 'temperature_difference_to_average_until_1990'])
df = df.astype({'year_end': 'int32'})
df.insert(0, 'year_start', df['year_end'] - 9)
print(df)
print(df.dtypes)
df.to_csv("../data/temperature.slovenia_historical.map_running_10year_average.csv", index=False, float_format='%.3f')
