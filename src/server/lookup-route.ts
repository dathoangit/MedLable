import type { ServerResponse } from 'node:http';
import { LOOKUP_API_VERSION } from '../contracts/lookup.v1';
import {
  lookupByMaBenhAn,
  lookupByMaHoSo,
  parseMaBenhAn,
  parseMaHoSo
} from '../db/lookup';
import { errorBody, logServerError, toPublicError } from './errors';
import { sendJson } from './http';

function medicationCount(orders: { medicationCount: number }[]): number {
  return orders.reduce((sum, order) => sum + order.medicationCount, 0);
}

export async function handleLookup(
  reqUrl: URL,
  res: ServerResponse
): Promise<void> {
  const maHoSoRaw =
    reqUrl.searchParams.get('ma-ho-so') ??
    reqUrl.searchParams.get('maHoSo') ??
    '';
  const maBenhAnRaw =
    reqUrl.searchParams.get('ma-benh-an') ??
    reqUrl.searchParams.get('maBenhAn') ??
    '';

  if (maHoSoRaw && maBenhAnRaw) {
    sendJson(
      res,
      400,
      errorBody(
        'VALIDATION',
        'Chỉ gửi một trong hai: ma-ho-so hoặc ma-benh-an.'
      )
    );
    return;
  }

  if (!maHoSoRaw && !maBenhAnRaw) {
    sendJson(
      res,
      400,
      errorBody('VALIDATION', 'Thiếu tham số ma-ho-so hoặc ma-benh-an.')
    );
    return;
  }

  try {
    if (maHoSoRaw) {
      const parsed = parseMaHoSo(maHoSoRaw);
      if (!parsed.ok) {
        sendJson(res, 400, errorBody('VALIDATION', parsed.error));
        return;
      }

      const result = await lookupByMaHoSo(parsed.maHoSo);
      if (!result) {
        sendJson(
          res,
          404,
          errorBody(
            'NOT_FOUND',
            `Không tìm thấy mã hồ sơ ${parsed.maHoSo} (his_patientdocument). Không dùng mã NB.`
          )
        );
        return;
      }

      sendJson(res, 200, {
        apiVersion: LOOKUP_API_VERSION,
        lookupBy: 'maHoSo',
        dateHint: parsed.dateHint,
        orderCount: result.orders.length,
        medicationCount: medicationCount(result.orders),
        patient: result.patient,
        orders: result.orders,
        matchCount: result.matchCount
      });
      return;
    }

    const parsedBa = parseMaBenhAn(maBenhAnRaw);
    if (!parsedBa.ok) {
      sendJson(res, 400, errorBody('VALIDATION', parsedBa.error));
      return;
    }

    const result = await lookupByMaBenhAn(parsedBa.maBenhAn);
    if (!result) {
      sendJson(
        res,
        404,
        errorBody(
          'NOT_FOUND',
          `Không tìm thấy mã bệnh án ${parsedBa.maBenhAn} (his_medicalrecordno).`
        )
      );
      return;
    }

    sendJson(res, 200, {
      apiVersion: LOOKUP_API_VERSION,
      lookupBy: 'maBenhAn',
      orderCount: result.orders.length,
      medicationCount: medicationCount(result.orders),
      patient: result.patient,
      orders: result.orders,
      matchCount: result.matchCount
    });
  } catch (error) {
    logServerError(error);
    sendJson(res, 500, toPublicError(error));
  }
}
