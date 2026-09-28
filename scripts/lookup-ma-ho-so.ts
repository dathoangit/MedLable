import { closePool } from '../src/db/pool';
import {
  lookupByMaBenhAn,
  lookupByMaHoSo,
  parseMaBenhAn,
  parseMaHoSo
} from '../src/db/lookup';

function readFlag(argv: string[], name: string): string | null {
  const eq = `--${name}=`;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg.startsWith(eq)) {
      return arg.slice(eq.length);
    }
    if (arg === `--${name}`) {
      return argv[i + 1] ?? null;
    }
  }
  return null;
}

async function main(): Promise<void> {
  const argv = process.argv.slice(2);
  const maHoSoRaw = readFlag(argv, 'ma-ho-so');
  const maBenhAnRaw = readFlag(argv, 'ma-benh-an');

  if (maHoSoRaw && maBenhAnRaw) {
    console.error('Provide only one of --ma-ho-so or --ma-benh-an.');
    process.exitCode = 1;
    return;
  }

  if (!maHoSoRaw && !maBenhAnRaw) {
    console.error(
      'Usage:\n  yarn lookup --ma-ho-so=2609230012\n  yarn lookup --ma-benh-an=2641600'
    );
    process.exitCode = 1;
    return;
  }

  if (maHoSoRaw) {
    const parsed = parseMaHoSo(maHoSoRaw);
    if (!parsed.ok) {
      console.error(parsed.error);
      process.exitCode = 1;
      return;
    }

    console.error(
      `Looking up mã hồ sơ ${parsed.maHoSo} (date hint ${parsed.dateHint})…`
    );

    const result = await lookupByMaHoSo(parsed.maHoSo);
    if (!result) {
      console.error(
        `Not found for his_patientdocument=${parsed.maHoSo}. ` +
          'Do not use mã NB (his_patienthistory.value).'
      );
      process.exitCode = 1;
      return;
    }

    console.log(
      JSON.stringify(
        {
          lookupBy: 'maHoSo',
          dateHint: parsed.dateHint,
          orderCount: result.orders.length,
          medicationCount: result.orders.reduce(
            (sum, order) => sum + order.medicationCount,
            0
          ),
          ...result
        },
        null,
        2
      )
    );
    return;
  }

  const parsedBa = parseMaBenhAn(maBenhAnRaw!);
  if (!parsedBa.ok) {
    console.error(parsedBa.error);
    process.exitCode = 1;
    return;
  }

  console.error(`Looking up mã bệnh án ${parsedBa.maBenhAn}…`);
  const result = await lookupByMaBenhAn(parsedBa.maBenhAn);
  if (!result) {
    console.error(`Not found for his_medicalrecordno=${parsedBa.maBenhAn}.`);
    process.exitCode = 1;
    return;
  }

  if (result.matchCount > 1) {
    console.error(
      `Note: ${result.matchCount} encounters share this mã bệnh án; using latest by timegoin.`
    );
  }

  console.log(
    JSON.stringify(
      {
        lookupBy: 'maBenhAn',
        orderCount: result.orders.length,
        medicationCount: result.orders.reduce(
          (sum, order) => sum + order.medicationCount,
          0
        ),
        ...result
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error('FAIL:', message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closePool();
  });
