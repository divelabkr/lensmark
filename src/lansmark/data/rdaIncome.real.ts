/**
 * RDA 실 소득자료 테이블 — ⚠ 이 파일은 `npm run rda:build <csv> [regional.csv]`가 재생성한다(수동 편집 금지).
 *   생성: 2026-06-11T20:39:08.475Z · 10작물 · 기준연도 2024 · 지역행 apple(8),blueberry(7),grape(10),sweet_potato(8),potato(9),strawberry(5),napa_cabbage(8),sesame(5),perilla(5),barley(1)
 */
import type { RdaRealRow, RdaRegionalTable } from "./rdaRealLoader";

export const RDA_REAL: Record<string, RdaRealRow> = {
  "apple": {
    "cropId": "apple",
    "baseYear": 2024,
    "yieldKgPer10a": {
      "p10": 1487,
      "p50": 1982,
      "p90": 2577
    },
    "operatingCostPer10aKrw": {
      "p10": 2964818,
      "p50": 3706022,
      "p90": 4447226
    },
    "refPriceKrwPerKg": {
      "p10": 3338,
      "p50": 4450,
      "p90": 5785
    },
    "source": "농진청 농산물소득조사 2024 (일부 폭 추정)"
  },
  "blueberry": {
    "cropId": "blueberry",
    "baseYear": 2024,
    "yieldKgPer10a": {
      "p10": 368,
      "p50": 491,
      "p90": 638
    },
    "operatingCostPer10aKrw": {
      "p10": 4143766,
      "p50": 5179707,
      "p90": 6215648
    },
    "refPriceKrwPerKg": {
      "p10": 17780,
      "p50": 23706,
      "p90": 30818
    },
    "source": "농진청 농산물소득조사 2024 (일부 폭 추정)"
  },
  "grape": {
    "cropId": "grape",
    "baseYear": 2024,
    "yieldKgPer10a": {
      "p10": 1239,
      "p50": 1652,
      "p90": 2148
    },
    "operatingCostPer10aKrw": {
      "p10": 3507794,
      "p50": 4384742,
      "p90": 5261690
    },
    "refPriceKrwPerKg": {
      "p10": 4478,
      "p50": 5971,
      "p90": 7762
    },
    "source": "농진청 농산물소득조사 2024 (일부 폭 추정)"
  },
  "sweet_potato": {
    "cropId": "sweet_potato",
    "baseYear": 2024,
    "yieldKgPer10a": {
      "p10": 1265,
      "p50": 1686,
      "p90": 2192
    },
    "operatingCostPer10aKrw": {
      "p10": 1535402,
      "p50": 1919252,
      "p90": 2303102
    },
    "refPriceKrwPerKg": {
      "p10": 1615,
      "p50": 2153,
      "p90": 2799
    },
    "source": "농진청 농산물소득조사 2024 (일부 폭 추정)"
  },
  "potato": {
    "cropId": "potato",
    "baseYear": 2024,
    "yieldKgPer10a": {
      "p10": 1697,
      "p50": 2263,
      "p90": 2942
    },
    "operatingCostPer10aKrw": {
      "p10": 1154809,
      "p50": 1443511,
      "p90": 1732213
    },
    "refPriceKrwPerKg": {
      "p10": 893,
      "p50": 1190,
      "p90": 1547
    },
    "source": "농진청 농산물소득조사 2024 (일부 폭 추정)"
  },
  "strawberry": {
    "cropId": "strawberry",
    "baseYear": 2024,
    "yieldKgPer10a": {
      "p10": 2170,
      "p50": 2893,
      "p90": 3761
    },
    "operatingCostPer10aKrw": {
      "p10": 12496673,
      "p50": 15620841,
      "p90": 18745009
    },
    "refPriceKrwPerKg": {
      "p10": 6820,
      "p50": 9093,
      "p90": 11821
    },
    "source": "농진청 농산물소득조사 2024 (일부 폭 추정)"
  },
  "napa_cabbage": {
    "cropId": "napa_cabbage",
    "baseYear": 2024,
    "yieldKgPer10a": {
      "p10": 4616,
      "p50": 6155,
      "p90": 8002
    },
    "operatingCostPer10aKrw": {
      "p10": 1227002,
      "p50": 1533753,
      "p90": 1840504
    },
    "refPriceKrwPerKg": {
      "p10": 504,
      "p50": 672,
      "p90": 874
    },
    "source": "농진청 농산물소득조사 2024 (일부 폭 추정)"
  },
  "sesame": {
    "cropId": "sesame",
    "baseYear": 2024,
    "yieldKgPer10a": {
      "p10": 53,
      "p50": 71,
      "p90": 92
    },
    "operatingCostPer10aKrw": {
      "p10": 616242,
      "p50": 770302,
      "p90": 924362
    },
    "refPriceKrwPerKg": {
      "p10": 19182,
      "p50": 25576,
      "p90": 33249
    },
    "source": "농진청 농산물소득조사 2024 (일부 폭 추정)"
  },
  "perilla": {
    "cropId": "perilla",
    "baseYear": 2024,
    "yieldKgPer10a": {
      "p10": 65,
      "p50": 86,
      "p90": 112
    },
    "operatingCostPer10aKrw": {
      "p10": 398115,
      "p50": 497644,
      "p90": 597173
    },
    "refPriceKrwPerKg": {
      "p10": 9545,
      "p50": 12727,
      "p90": 16545
    },
    "source": "농진청 농산물소득조사 2024 (일부 폭 추정)"
  },
  "barley": {
    "cropId": "barley",
    "baseYear": 2024,
    "yieldKgPer10a": {
      "p10": 252,
      "p50": 336,
      "p90": 437
    },
    "operatingCostPer10aKrw": {
      "p10": 288365,
      "p50": 360456,
      "p90": 432547
    },
    "refPriceKrwPerKg": {
      "p10": 981,
      "p50": 1308,
      "p90": 1700
    },
    "source": "농진청 농산물소득조사 2024 (일부 폭 추정)"
  }
};

/** 지역(도) 오버라이드 — cropId→도(2자 코드)→실값. getRdaBase(cropId, region)이 우선 사용(없는 도는 전국 폴백). 빈 객체=전국만. */
export const RDA_REAL_REGION: RdaRegionalTable = {
  "apple": {
    "강원": {
      "yieldKgPer10a": {
        "p10": 1305,
        "p50": 1740,
        "p90": 2262
      },
      "operatingCostPer10aKrw": {
        "p10": 2483720,
        "p50": 3104650,
        "p90": 3725580
      },
      "refPriceKrwPerKg": {
        "p10": 3734,
        "p50": 4978,
        "p90": 6471
      }
    },
    "경기": {
      "yieldKgPer10a": {
        "p10": 1318,
        "p50": 1757,
        "p90": 2284
      },
      "operatingCostPer10aKrw": {
        "p10": 2908298,
        "p50": 3635373,
        "p90": 4362448
      },
      "refPriceKrwPerKg": {
        "p10": 3793,
        "p50": 5057,
        "p90": 6574
      }
    },
    "경남": {
      "yieldKgPer10a": {
        "p10": 1778,
        "p50": 2370,
        "p90": 3081
      },
      "operatingCostPer10aKrw": {
        "p10": 3155202,
        "p50": 3944003,
        "p90": 4732804
      },
      "refPriceKrwPerKg": {
        "p10": 3107,
        "p50": 4143,
        "p90": 5386
      }
    },
    "경북": {
      "yieldKgPer10a": {
        "p10": 1826,
        "p50": 2434,
        "p90": 3164
      },
      "operatingCostPer10aKrw": {
        "p10": 3198916,
        "p50": 3998645,
        "p90": 4798374
      },
      "refPriceKrwPerKg": {
        "p10": 3023,
        "p50": 4031,
        "p90": 5240
      }
    },
    "전남": {
      "yieldKgPer10a": {
        "p10": 747,
        "p50": 996,
        "p90": 1295
      },
      "operatingCostPer10aKrw": {
        "p10": 3045346,
        "p50": 3806682,
        "p90": 4568018
      },
      "refPriceKrwPerKg": {
        "p10": 3976,
        "p50": 5301,
        "p90": 6891
      }
    },
    "전북": {
      "yieldKgPer10a": {
        "p10": 1072,
        "p50": 1429,
        "p90": 1858
      },
      "operatingCostPer10aKrw": {
        "p10": 3172345,
        "p50": 3965431,
        "p90": 4758517
      },
      "refPriceKrwPerKg": {
        "p10": 4023,
        "p50": 5364,
        "p90": 6973
      }
    },
    "충남": {
      "yieldKgPer10a": {
        "p10": 1935,
        "p50": 2580,
        "p90": 3354
      },
      "operatingCostPer10aKrw": {
        "p10": 3514073,
        "p50": 4392591,
        "p90": 5271109
      },
      "refPriceKrwPerKg": {
        "p10": 2437,
        "p50": 3249,
        "p90": 4224
      }
    },
    "충북": {
      "yieldKgPer10a": {
        "p10": 1220,
        "p50": 1626,
        "p90": 2114
      },
      "operatingCostPer10aKrw": {
        "p10": 2057535,
        "p50": 2571919,
        "p90": 3086303
      },
      "refPriceKrwPerKg": {
        "p10": 4139,
        "p50": 5519,
        "p90": 7175
      }
    }
  },
  "blueberry": {
    "강원": {
      "yieldKgPer10a": {
        "p10": 307,
        "p50": 409,
        "p90": 532
      },
      "operatingCostPer10aKrw": {
        "p10": 2533544,
        "p50": 3166930,
        "p90": 3800316
      },
      "refPriceKrwPerKg": {
        "p10": 18552,
        "p50": 24736,
        "p90": 32157
      }
    },
    "경기": {
      "yieldKgPer10a": {
        "p10": 306,
        "p50": 408,
        "p90": 530
      },
      "operatingCostPer10aKrw": {
        "p10": 4288506,
        "p50": 5360632,
        "p90": 6432758
      },
      "refPriceKrwPerKg": {
        "p10": 17801,
        "p50": 23734,
        "p90": 30854
      }
    },
    "경남": {
      "yieldKgPer10a": {
        "p10": 354,
        "p50": 472,
        "p90": 614
      },
      "operatingCostPer10aKrw": {
        "p10": 3561635,
        "p50": 4452044,
        "p90": 5342453
      },
      "refPriceKrwPerKg": {
        "p10": 17195,
        "p50": 22926,
        "p90": 29804
      }
    },
    "전남": {
      "yieldKgPer10a": {
        "p10": 473,
        "p50": 630,
        "p90": 819
      },
      "operatingCostPer10aKrw": {
        "p10": 6880587,
        "p50": 8600734,
        "p90": 10320881
      },
      "refPriceKrwPerKg": {
        "p10": 19378,
        "p50": 25837,
        "p90": 33588
      }
    },
    "전북": {
      "yieldKgPer10a": {
        "p10": 361,
        "p50": 481,
        "p90": 625
      },
      "operatingCostPer10aKrw": {
        "p10": 2997754,
        "p50": 3747192,
        "p90": 4496630
      },
      "refPriceKrwPerKg": {
        "p10": 15395,
        "p50": 20526,
        "p90": 26684
      }
    },
    "충남": {
      "yieldKgPer10a": {
        "p10": 362,
        "p50": 483,
        "p90": 628
      },
      "operatingCostPer10aKrw": {
        "p10": 3610489,
        "p50": 4513111,
        "p90": 5415733
      },
      "refPriceKrwPerKg": {
        "p10": 17098,
        "p50": 22797,
        "p90": 29636
      }
    },
    "충북": {
      "yieldKgPer10a": {
        "p10": 359,
        "p50": 479,
        "p90": 623
      },
      "operatingCostPer10aKrw": {
        "p10": 3133768,
        "p50": 3917210,
        "p90": 4700652
      },
      "refPriceKrwPerKg": {
        "p10": 18439,
        "p50": 24585,
        "p90": 31961
      }
    }
  },
  "grape": {
    "강원": {
      "yieldKgPer10a": {
        "p10": 972,
        "p50": 1296,
        "p90": 1685
      },
      "operatingCostPer10aKrw": {
        "p10": 2577198,
        "p50": 3221497,
        "p90": 3865796
      },
      "refPriceKrwPerKg": {
        "p10": 4336,
        "p50": 5781,
        "p90": 7515
      }
    },
    "경기": {
      "yieldKgPer10a": {
        "p10": 884,
        "p50": 1179,
        "p90": 1533
      },
      "operatingCostPer10aKrw": {
        "p10": 2590606,
        "p50": 3238258,
        "p90": 3885910
      },
      "refPriceKrwPerKg": {
        "p10": 5666,
        "p50": 7555,
        "p90": 9822
      }
    },
    "경남": {
      "yieldKgPer10a": {
        "p10": 1287,
        "p50": 1716,
        "p90": 2231
      },
      "operatingCostPer10aKrw": {
        "p10": 4098511,
        "p50": 5123139,
        "p90": 6147767
      },
      "refPriceKrwPerKg": {
        "p10": 4139,
        "p50": 5519,
        "p90": 7175
      }
    },
    "경북": {
      "yieldKgPer10a": {
        "p10": 1734,
        "p50": 2312,
        "p90": 3006
      },
      "operatingCostPer10aKrw": {
        "p10": 4765352,
        "p50": 5956690,
        "p90": 7148028
      },
      "refPriceKrwPerKg": {
        "p10": 3629,
        "p50": 4839,
        "p90": 6291
      }
    },
    "대구": {
      "yieldKgPer10a": {
        "p10": 1045,
        "p50": 1393,
        "p90": 1811
      },
      "operatingCostPer10aKrw": {
        "p10": 3108346,
        "p50": 3885433,
        "p90": 4662520
      },
      "refPriceKrwPerKg": {
        "p10": 3971,
        "p50": 5295,
        "p90": 6884
      }
    },
    "인천": {
      "yieldKgPer10a": {
        "p10": 865,
        "p50": 1153,
        "p90": 1499
      },
      "operatingCostPer10aKrw": {
        "p10": 2319764,
        "p50": 2899705,
        "p90": 3479646
      },
      "refPriceKrwPerKg": {
        "p10": 6587,
        "p50": 8782,
        "p90": 11417
      }
    },
    "전남": {
      "yieldKgPer10a": {
        "p10": 1006,
        "p50": 1341,
        "p90": 1743
      },
      "operatingCostPer10aKrw": {
        "p10": 3467146,
        "p50": 4333933,
        "p90": 5200720
      },
      "refPriceKrwPerKg": {
        "p10": 6845,
        "p50": 9127,
        "p90": 11865
      }
    },
    "전북": {
      "yieldKgPer10a": {
        "p10": 1208,
        "p50": 1611,
        "p90": 2094
      },
      "operatingCostPer10aKrw": {
        "p10": 3176258,
        "p50": 3970323,
        "p90": 4764388
      },
      "refPriceKrwPerKg": {
        "p10": 4735,
        "p50": 6313,
        "p90": 8207
      }
    },
    "충남": {
      "yieldKgPer10a": {
        "p10": 824,
        "p50": 1099,
        "p90": 1429
      },
      "operatingCostPer10aKrw": {
        "p10": 2683454,
        "p50": 3354317,
        "p90": 4025180
      },
      "refPriceKrwPerKg": {
        "p10": 4829,
        "p50": 6438,
        "p90": 8369
      }
    },
    "충북": {
      "yieldKgPer10a": {
        "p10": 843,
        "p50": 1124,
        "p90": 1461
      },
      "operatingCostPer10aKrw": {
        "p10": 1956351,
        "p50": 2445439,
        "p90": 2934527
      },
      "refPriceKrwPerKg": {
        "p10": 6282,
        "p50": 8376,
        "p90": 10889
      }
    }
  },
  "sweet_potato": {
    "경기": {
      "yieldKgPer10a": {
        "p10": 1478,
        "p50": 1971,
        "p90": 2562
      },
      "operatingCostPer10aKrw": {
        "p10": 1857297,
        "p50": 2321621,
        "p90": 2785945
      },
      "refPriceKrwPerKg": {
        "p10": 1523,
        "p50": 2031,
        "p90": 2640
      }
    },
    "경남": {
      "yieldKgPer10a": {
        "p10": 1022,
        "p50": 1363,
        "p90": 1772
      },
      "operatingCostPer10aKrw": {
        "p10": 1074993,
        "p50": 1343741,
        "p90": 1612489
      },
      "refPriceKrwPerKg": {
        "p10": 1798,
        "p50": 2397,
        "p90": 3116
      }
    },
    "경북": {
      "yieldKgPer10a": {
        "p10": 1130,
        "p50": 1507,
        "p90": 1959
      },
      "operatingCostPer10aKrw": {
        "p10": 1221389,
        "p50": 1526736,
        "p90": 1832083
      },
      "refPriceKrwPerKg": {
        "p10": 1615,
        "p50": 2153,
        "p90": 2799
      }
    },
    "인천": {
      "yieldKgPer10a": {
        "p10": 623,
        "p50": 830,
        "p90": 1079
      },
      "operatingCostPer10aKrw": {
        "p10": 993543,
        "p50": 1241929,
        "p90": 1490315
      },
      "refPriceKrwPerKg": {
        "p10": 2528,
        "p50": 3371,
        "p90": 4382
      }
    },
    "전남": {
      "yieldKgPer10a": {
        "p10": 1204,
        "p50": 1605,
        "p90": 2087
      },
      "operatingCostPer10aKrw": {
        "p10": 1754650,
        "p50": 2193313,
        "p90": 2631976
      },
      "refPriceKrwPerKg": {
        "p10": 1714,
        "p50": 2285,
        "p90": 2971
      }
    },
    "전북": {
      "yieldKgPer10a": {
        "p10": 1633,
        "p50": 2177,
        "p90": 2830
      },
      "operatingCostPer10aKrw": {
        "p10": 2003782,
        "p50": 2504728,
        "p90": 3005674
      },
      "refPriceKrwPerKg": {
        "p10": 1357,
        "p50": 1809,
        "p90": 2352
      }
    },
    "충남": {
      "yieldKgPer10a": {
        "p10": 1502,
        "p50": 2003,
        "p90": 2604
      },
      "operatingCostPer10aKrw": {
        "p10": 1279164,
        "p50": 1598955,
        "p90": 1918746
      },
      "refPriceKrwPerKg": {
        "p10": 1271,
        "p50": 1695,
        "p90": 2204
      }
    },
    "충북": {
      "yieldKgPer10a": {
        "p10": 981,
        "p50": 1308,
        "p90": 1700
      },
      "operatingCostPer10aKrw": {
        "p10": 1275846,
        "p50": 1594808,
        "p90": 1913770
      },
      "refPriceKrwPerKg": {
        "p10": 2278,
        "p50": 3037,
        "p90": 3948
      }
    }
  },
  "potato": {
    "강원": {
      "yieldKgPer10a": {
        "p10": 1775,
        "p50": 2367,
        "p90": 3077
      },
      "operatingCostPer10aKrw": {
        "p10": 940398,
        "p50": 1175498,
        "p90": 1410598
      },
      "refPriceKrwPerKg": {
        "p10": 980,
        "p50": 1307,
        "p90": 1699
      }
    },
    "경기": {
      "yieldKgPer10a": {
        "p10": 1451,
        "p50": 1935,
        "p90": 2516
      },
      "operatingCostPer10aKrw": {
        "p10": 1256417,
        "p50": 1570521,
        "p90": 1884625
      },
      "refPriceKrwPerKg": {
        "p10": 926,
        "p50": 1235,
        "p90": 1606
      }
    },
    "경남": {
      "yieldKgPer10a": {
        "p10": 1253,
        "p50": 1670,
        "p90": 2171
      },
      "operatingCostPer10aKrw": {
        "p10": 798959,
        "p50": 998699,
        "p90": 1198439
      },
      "refPriceKrwPerKg": {
        "p10": 869,
        "p50": 1159,
        "p90": 1507
      }
    },
    "경북": {
      "yieldKgPer10a": {
        "p10": 2398,
        "p50": 3197,
        "p90": 4156
      },
      "operatingCostPer10aKrw": {
        "p10": 1665341,
        "p50": 2081676,
        "p90": 2498011
      },
      "refPriceKrwPerKg": {
        "p10": 767,
        "p50": 1022,
        "p90": 1329
      }
    },
    "전남": {
      "yieldKgPer10a": {
        "p10": 1520,
        "p50": 2026,
        "p90": 2634
      },
      "operatingCostPer10aKrw": {
        "p10": 1305266,
        "p50": 1631582,
        "p90": 1957898
      },
      "refPriceKrwPerKg": {
        "p10": 807,
        "p50": 1076,
        "p90": 1399
      }
    },
    "전북": {
      "yieldKgPer10a": {
        "p10": 1513,
        "p50": 2017,
        "p90": 2622
      },
      "operatingCostPer10aKrw": {
        "p10": 1320325,
        "p50": 1650406,
        "p90": 1980487
      },
      "refPriceKrwPerKg": {
        "p10": 1159,
        "p50": 1545,
        "p90": 2009
      }
    },
    "제주": {
      "yieldKgPer10a": {
        "p10": 1448,
        "p50": 1931,
        "p90": 2510
      },
      "operatingCostPer10aKrw": {
        "p10": 1071294,
        "p50": 1339118,
        "p90": 1606942
      },
      "refPriceKrwPerKg": {
        "p10": 695,
        "p50": 926,
        "p90": 1204
      }
    },
    "충남": {
      "yieldKgPer10a": {
        "p10": 1894,
        "p50": 2525,
        "p90": 3283
      },
      "operatingCostPer10aKrw": {
        "p10": 1170454,
        "p50": 1463068,
        "p90": 1755682
      },
      "refPriceKrwPerKg": {
        "p10": 819,
        "p50": 1092,
        "p90": 1420
      }
    },
    "충북": {
      "yieldKgPer10a": {
        "p10": 1894,
        "p50": 2525,
        "p90": 3283
      },
      "operatingCostPer10aKrw": {
        "p10": 1004278,
        "p50": 1255348,
        "p90": 1506418
      },
      "refPriceKrwPerKg": {
        "p10": 1026,
        "p50": 1368,
        "p90": 1778
      }
    }
  },
  "strawberry": {
    "경남": {
      "yieldKgPer10a": {
        "p10": 1878,
        "p50": 2504,
        "p90": 3255
      },
      "operatingCostPer10aKrw": {
        "p10": 11631772,
        "p50": 14539715,
        "p90": 17447658
      },
      "refPriceKrwPerKg": {
        "p10": 7111,
        "p50": 9481,
        "p90": 12325
      }
    },
    "경북": {
      "yieldKgPer10a": {
        "p10": 2106,
        "p50": 2808,
        "p90": 3650
      },
      "operatingCostPer10aKrw": {
        "p10": 11756539,
        "p50": 14695674,
        "p90": 17634809
      },
      "refPriceKrwPerKg": {
        "p10": 5871,
        "p50": 7828,
        "p90": 10176
      }
    },
    "전남": {
      "yieldKgPer10a": {
        "p10": 1741,
        "p50": 2321,
        "p90": 3017
      },
      "operatingCostPer10aKrw": {
        "p10": 12542641,
        "p50": 15678301,
        "p90": 18813961
      },
      "refPriceKrwPerKg": {
        "p10": 7953,
        "p50": 10604,
        "p90": 13785
      }
    },
    "전북": {
      "yieldKgPer10a": {
        "p10": 2704,
        "p50": 3605,
        "p90": 4687
      },
      "operatingCostPer10aKrw": {
        "p10": 15190931,
        "p50": 18988664,
        "p90": 22786397
      },
      "refPriceKrwPerKg": {
        "p10": 7100,
        "p50": 9467,
        "p90": 12307
      }
    },
    "충남": {
      "yieldKgPer10a": {
        "p10": 2348,
        "p50": 3131,
        "p90": 4070
      },
      "operatingCostPer10aKrw": {
        "p10": 11605014,
        "p50": 14506268,
        "p90": 17407522
      },
      "refPriceKrwPerKg": {
        "p10": 6616,
        "p50": 8821,
        "p90": 11467
      }
    }
  },
  "napa_cabbage": {
    "강원": {
      "yieldKgPer10a": {
        "p10": 3629,
        "p50": 4838,
        "p90": 6289
      },
      "operatingCostPer10aKrw": {
        "p10": 1185992,
        "p50": 1482490,
        "p90": 1778988
      },
      "refPriceKrwPerKg": {
        "p10": 665,
        "p50": 887,
        "p90": 1153
      }
    },
    "경기": {
      "yieldKgPer10a": {
        "p10": 3293,
        "p50": 4391,
        "p90": 5708
      },
      "operatingCostPer10aKrw": {
        "p10": 1198216,
        "p50": 1497770,
        "p90": 1797324
      },
      "refPriceKrwPerKg": {
        "p10": 757,
        "p50": 1009,
        "p90": 1312
      }
    },
    "경남": {
      "yieldKgPer10a": {
        "p10": 3631,
        "p50": 4841,
        "p90": 6293
      },
      "operatingCostPer10aKrw": {
        "p10": 1657569,
        "p50": 2071961,
        "p90": 2486353
      },
      "refPriceKrwPerKg": {
        "p10": 1229,
        "p50": 1639,
        "p90": 2131
      }
    },
    "경북": {
      "yieldKgPer10a": {
        "p10": 5257,
        "p50": 7009,
        "p90": 9112
      },
      "operatingCostPer10aKrw": {
        "p10": 1083666,
        "p50": 1354583,
        "p90": 1625500
      },
      "refPriceKrwPerKg": {
        "p10": 260,
        "p50": 347,
        "p90": 451
      }
    },
    "전남": {
      "yieldKgPer10a": {
        "p10": 6806,
        "p50": 9075,
        "p90": 11798
      },
      "operatingCostPer10aKrw": {
        "p10": 1436597,
        "p50": 1795746,
        "p90": 2154895
      },
      "refPriceKrwPerKg": {
        "p10": 369,
        "p50": 492,
        "p90": 640
      }
    },
    "전북": {
      "yieldKgPer10a": {
        "p10": 4916,
        "p50": 6555,
        "p90": 8522
      },
      "operatingCostPer10aKrw": {
        "p10": 1308722,
        "p50": 1635902,
        "p90": 1963082
      },
      "refPriceKrwPerKg": {
        "p10": 545,
        "p50": 727,
        "p90": 945
      }
    },
    "충남": {
      "yieldKgPer10a": {
        "p10": 4439,
        "p50": 5919,
        "p90": 7695
      },
      "operatingCostPer10aKrw": {
        "p10": 1076058,
        "p50": 1345073,
        "p90": 1614088
      },
      "refPriceKrwPerKg": {
        "p10": 398,
        "p50": 531,
        "p90": 690
      }
    },
    "충북": {
      "yieldKgPer10a": {
        "p10": 4175,
        "p50": 5567,
        "p90": 7237
      },
      "operatingCostPer10aKrw": {
        "p10": 1000081,
        "p50": 1250101,
        "p90": 1500121
      },
      "refPriceKrwPerKg": {
        "p10": 413,
        "p50": 550,
        "p90": 715
      }
    }
  },
  "sesame": {
    "경기": {
      "yieldKgPer10a": {
        "p10": 50,
        "p50": 66,
        "p90": 86
      },
      "operatingCostPer10aKrw": {
        "p10": 535660,
        "p50": 669575,
        "p90": 803490
      },
      "refPriceKrwPerKg": {
        "p10": 21968,
        "p50": 29290,
        "p90": 38077
      }
    },
    "경남": {
      "yieldKgPer10a": {
        "p10": 38,
        "p50": 51,
        "p90": 66
      },
      "operatingCostPer10aKrw": {
        "p10": 315787,
        "p50": 394734,
        "p90": 473681
      },
      "refPriceKrwPerKg": {
        "p10": 19615,
        "p50": 26153,
        "p90": 33999
      }
    },
    "경북": {
      "yieldKgPer10a": {
        "p10": 50,
        "p50": 67,
        "p90": 87
      },
      "operatingCostPer10aKrw": {
        "p10": 630755,
        "p50": 788444,
        "p90": 946133
      },
      "refPriceKrwPerKg": {
        "p10": 19801,
        "p50": 26401,
        "p90": 34321
      }
    },
    "전남": {
      "yieldKgPer10a": {
        "p10": 61,
        "p50": 81,
        "p90": 105
      },
      "operatingCostPer10aKrw": {
        "p10": 656582,
        "p50": 820727,
        "p90": 984872
      },
      "refPriceKrwPerKg": {
        "p10": 16925,
        "p50": 22566,
        "p90": 29336
      }
    },
    "전북": {
      "yieldKgPer10a": {
        "p10": 68,
        "p50": 90,
        "p90": 117
      },
      "operatingCostPer10aKrw": {
        "p10": 919302,
        "p50": 1149127,
        "p90": 1378952
      },
      "refPriceKrwPerKg": {
        "p10": 18692,
        "p50": 24922,
        "p90": 32399
      }
    }
  },
  "perilla": {
    "강원": {
      "yieldKgPer10a": {
        "p10": 53,
        "p50": 70,
        "p90": 91
      },
      "operatingCostPer10aKrw": {
        "p10": 381662,
        "p50": 477077,
        "p90": 572492
      },
      "refPriceKrwPerKg": {
        "p10": 9222,
        "p50": 12296,
        "p90": 15985
      }
    },
    "경기": {
      "yieldKgPer10a": {
        "p10": 76,
        "p50": 101,
        "p90": 131
      },
      "operatingCostPer10aKrw": {
        "p10": 459789,
        "p50": 574736,
        "p90": 689683
      },
      "refPriceKrwPerKg": {
        "p10": 9874,
        "p50": 13165,
        "p90": 17115
      }
    },
    "경북": {
      "yieldKgPer10a": {
        "p10": 50,
        "p50": 67,
        "p90": 87
      },
      "operatingCostPer10aKrw": {
        "p10": 380790,
        "p50": 475988,
        "p90": 571186
      },
      "refPriceKrwPerKg": {
        "p10": 9850,
        "p50": 13133,
        "p90": 17073
      }
    },
    "충남": {
      "yieldKgPer10a": {
        "p10": 67,
        "p50": 89,
        "p90": 116
      },
      "operatingCostPer10aKrw": {
        "p10": 317194,
        "p50": 396493,
        "p90": 475792
      },
      "refPriceKrwPerKg": {
        "p10": 8828,
        "p50": 11771,
        "p90": 15302
      }
    },
    "충북": {
      "yieldKgPer10a": {
        "p10": 65,
        "p50": 87,
        "p90": 113
      },
      "operatingCostPer10aKrw": {
        "p10": 388816,
        "p50": 486020,
        "p90": 583224
      },
      "refPriceKrwPerKg": {
        "p10": 9428,
        "p50": 12571,
        "p90": 16342
      }
    }
  },
  "barley": {
    "전북": {
      "yieldKgPer10a": {
        "p10": 266,
        "p50": 354,
        "p90": 460
      },
      "operatingCostPer10aKrw": {
        "p10": 257892,
        "p50": 322365,
        "p90": 386838
      },
      "refPriceKrwPerKg": {
        "p10": 982,
        "p50": 1309,
        "p90": 1702
      }
    }
  }
};

/** 실자료 메타(빌드 시 기록) — ops/health 노출용. null=실자료 미적재(데모). */
export const RDA_REAL_META: { builtAt: string; rows: number; baseYears: number[]; regions: number } | null = {"builtAt":"2026-06-11T20:39:08.476Z","rows":10,"baseYears":[2024],"regions":66};
