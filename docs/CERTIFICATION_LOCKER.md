# Certification locker (self-reported records)

- GET /api/me/certifications — retrieve authenticated account's records.
- PUT /api/me/certifications with {items:[{id,name,category,issuer,status,acquiredOn,updatedAt,deleted}]} — merge.
- Authentication: existing Bearer access token. Items are isolated by user id.
- Records are **self-reported** and cannot be labeled Q-Net verified or issued by an authority.
- Client timestamps resolve concurrent updates; deletions use tombstones to prevent device re-import.
- Official public HRDK/Q-Net OpenAPI provides qualification catalogs and exams, **not individuals' verified acquisitions**. An approved user-consented integration is required to offer actual auto-import.
- Certificate registration numbers, birth dates and ID numbers are not collected by this endpoint.
