from decimal import Decimal

from frictionless import Row


def read_frictionless_resource_data(resource):
    def read_row_data(row: Row):
        for value in row.values():
            if isinstance(value, Decimal):
                yield float(value)
            else:
                yield value

    return [list(read_row_data(row)) for row in resource.read_rows()]
