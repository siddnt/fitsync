# Query Plan Report

Generated: 2026-04-19T16:05:45.725Z

| Query | Winning Stage | Indexes Used | Keys Examined | Docs Examined | Returned |
| --- | --- | --- | ---: | ---: | ---: |
| Gym catalogue text search | SORT | name_text_description_text_tags_text_keyFeatures_text | 3 | 6 | 3 |
| Marketplace catalogue text search | SORT | product_search_text_idx | 4 | 4 | 2 |
| Seller order lookup | LIMIT | orderItems.seller_1_createdAt_-1 | 0 | 0 | 0 |

Representative queries:
- Public gym catalogue search
- Public marketplace catalogue search
- Seller order lookup