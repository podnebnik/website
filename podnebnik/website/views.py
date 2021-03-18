import pandas as pd
from django.shortcuts import render


def home(request):
    emissions_data_df = pd.read_csv("https://raw.githubusercontent.com/podnebnik/data/master/csv/emissions_historical.csv")
    emissions_data_df.drop('emissions_CO2_equiv.total', axis=1, inplace=True)

    return render(request, 'website/home.html', {
        'emissions_data': emissions_data_df.values.tolist()
    })
