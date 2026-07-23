# T-3.3 — proof that the pytest runner is wired for data/climate-si/sources/.
#
# One trivial passing test, nothing more. The real pipeline unit tests
# (window_filter, lapse correction, Theil-Sen, SPEI, tropical NB-GLM) are T-3.5;
# do not add them here.


def test_runner_is_wired():
    assert 1 + 1 == 2
